"""Retrieval eval: recall@k and MRR on hand-labelled questions.

Usage (from the repo root, with Postgres+pgvector running and the corpus fetched):

    evals/corpus/fetch_corpus.sh
    GOOGLE_API_KEY=... DATABASE_URL=postgresql://rag:rag@localhost:5433/rag \\
        python evals/retrieval/run_retrieval_eval.py --labels evals/data/retrieval_labels.txt

It ingests each corpus PDF with the service's own code (idempotent, so
re-runs don't re-embed), runs every labelled question through each retrieval
mode, and writes a summary plus a per-question report to evals/runs/<timestamp>/.
"""

import argparse
import csv
import datetime as dt
import json
import os
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "rag_service"))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.db import make_pool, migrate
from app.embeddings import GeminiEmbedder
from app.ingest import ingest_pdf
from app.pdf import extract_pages
from app.retrieval import Mode, retrieve
from app.store import ChunkStore, SearchFilters
from labels import Label, load_labels, resolve_gold_pages
from metrics import first_relevant_rank, mrr_at_k, recall_at_k

EVAL_USER = "eval"
KS = (1, 3, 5, 10)


class CachedQueryEmbedder:
    """Dense and hybrid modes embed the same questions; embed each once."""

    def __init__(self, inner):
        self.inner, self._cache = inner, {}
        self.name, self.dim = inner.name, inner.dim

    def embed_documents(self, texts):
        return self.inner.embed_documents(texts)

    def embed_query(self, text):
        if text not in self._cache:
            self._cache[text] = self.inner.embed_query(text)
        return self._cache[text]


def parse_args(argv=None):
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--labels", type=Path, default=ROOT / "evals/data/retrieval_labels.txt")
    p.add_argument("--corpus", type=Path, default=ROOT / "evals/corpus")
    p.add_argument("--modes", default="dense,keyword,hybrid")
    p.add_argument("--chunk-size", type=int, default=1500)
    p.add_argument("--chunk-overlap", type=int, default=200)
    p.add_argument("--database-url", default=os.environ.get("DATABASE_URL", "postgresql://rag:rag@localhost:5433/rag"))
    p.add_argument("--out", type=Path, default=ROOT / "evals/runs")
    return p.parse_args(argv)


def main(argv=None, embedder=None) -> int:
    args = parse_args(argv)
    labels = load_labels(args.labels)
    if not labels:
        print(f"No labelled questions in {args.labels} (rows with id 'example*' are ignored).")
        return 1
    modes = [Mode(m.strip()) for m in args.modes.split(",")]

    migrate(args.database_url)
    pool = make_pool(args.database_url)
    store = ChunkStore(pool)
    embedder = CachedQueryEmbedder(
        embedder
        or GeminiEmbedder(
            api_key=os.environ.get("GOOGLE_API_KEY", ""),
            max_per_minute=int(os.environ.get("EMBEDDING_MAX_PER_MINUTE", "90")),
        )
    )

    # Ingest each document once per chunking config.
    doc_ids, gold = {}, {}
    by_doc: dict[str, list[Label]] = defaultdict(list)
    for label in labels:
        by_doc[label.doc].append(label)
    for doc, doc_labels in by_doc.items():
        pdf_path = args.corpus / f"{doc}.pdf"
        data = pdf_path.read_bytes()
        doc_id = f"eval:{doc}:{args.chunk_size}:{args.chunk_overlap}"
        res = ingest_pdf(
            store=store,
            embedder=embedder,
            document_id=doc_id,
            user_id=EVAL_USER,
            title=doc,
            data=data,
            chunk_size=args.chunk_size,
            chunk_overlap=args.chunk_overlap,
        )
        print(f"{doc}: {res.pages} pages, {res.chunks} chunks ({'cached' if res.skipped else 'ingested'})")
        pages = extract_pages(data)
        printed: dict[str, list[int]] = defaultdict(list)
        for pg in pages:
            printed[pg.label].append(pg.number)
        for label in doc_labels:
            gold[label.id] = resolve_gold_pages(label, printed, len(pages))
        doc_ids[doc] = doc_id

    max_k = max(KS)
    rows = []
    first_ranks: dict[Mode, list] = {m: [] for m in modes}
    for label in labels:
        row = {"id": label.id, "question": label.question, "gold_pages": gold[label.id], "tags": label.tags}
        for mode in modes:
            hits = retrieve(
                store=store,
                embedder=embedder,
                query=label.question,
                filters=SearchFilters(EVAL_USER, [doc_ids[label.doc]]),
                k=max_k,
                mode=mode,
            )
            ranked = [(h.page_start, h.page_end) for h in hits]
            rank = first_relevant_rank(ranked, gold[label.id])
            first_ranks[mode].append(rank)
            row[f"{mode}_rank"] = rank
            row[f"{mode}_top5_pages"] = [f"{s}" if s == e else f"{s}-{e}" for s, e in ranked[:5]]
        rows.append(row)
    pool.close()

    summary = {
        "run_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
        "n_questions": len(labels),
        "embedding_model": embedder.name,
        "chunk_size": args.chunk_size,
        "chunk_overlap": args.chunk_overlap,
        "modes": {
            m.value: {
                **{f"recall@{k}": round(recall_at_k(first_ranks[m], k), 3) for k in KS},
                "mrr@5": round(mrr_at_k(first_ranks[m], 5), 3),
            }
            for m in modes
        },
        "by_tag": by_tag(rows, modes),
    }
    out_dir = args.out / dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "summary.json").write_text(json.dumps(summary, indent=2))
    write_csv(out_dir / "per_question.csv", rows, modes)
    md = to_markdown(summary, rows, modes)
    (out_dir / "summary.md").write_text(md)
    print(md)
    print(f"\nWrote {out_dir}")
    return 0


def by_tag(rows, modes):
    groups = defaultdict(list)
    for r in rows:
        for t in r["tags"] or ["(untagged)"]:
            groups[t].append(r)
    out = {}
    for tag, rs in sorted(groups.items()):
        out[tag] = {"n": len(rs)}
        for m in modes:
            out[tag][f"{m.value} recall@5"] = round(recall_at_k([r[f"{m}_rank"] for r in rs], 5), 3)
    return out


def write_csv(path, rows, modes):
    cols = ["id", "question", "gold_pages", "tags"]
    for m in modes:
        cols += [f"{m}_rank", f"{m}_top5_pages"]
    with path.open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({c: (";".join(map(str, r[c])) if isinstance(r[c], list | tuple) else r[c]) for c in cols})


def to_markdown(summary, rows, modes) -> str:
    ks = [f"recall@{k}" for k in KS] + ["mrr@5"]
    lines = [
        f"Retrieval eval: {summary['n_questions']} questions, {summary['embedding_model']}, "
        f"chunks {summary['chunk_size']}/{summary['chunk_overlap']} chars",
        "",
        "| mode | " + " | ".join(ks) + " |",
        "|---|" + "---|" * len(ks),
    ]
    for m in modes:
        vals = summary["modes"][m.value]
        lines.append(f"| {m.value} | " + " | ".join(f"{vals[k]:.2f}" for k in ks) + " |")
    misses = [r for r in rows if any(r[f"{m}_rank"] is None or r[f"{m}_rank"] > 5 for m in modes)]
    if misses:
        lines += ["", "Misses at k=5 (rank shown per mode; '-' = not in top 10):", ""]
        for r in misses:
            ranks = ", ".join(f"{m.value}={r[f'{m}_rank'] or '-'}" for m in modes)
            lines.append(f"- `{r['id']}` gold p.{r['gold_pages']}: {ranks}. {r['question']}")
    return "\n".join(lines)


if __name__ == "__main__":
    raise SystemExit(main())
