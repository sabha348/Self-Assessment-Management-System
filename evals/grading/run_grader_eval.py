"""Grader agreement eval: auto-grader vs. the owner's blind hand grades.

    python evals/grading/run_grader_eval.py            # needs DATABASE_URL (eval corpus ingested) + GOOGLE_API_KEY

- New grader: the RAG service's point-based grader (grounded in each
  question's source chunks), run `--repeats` times to measure run-to-run
  stability.
- Baseline: the legacy grader (python_scripts/evaluate_answers.py: Gemini
  'Accuracy: NN' scraped by regex, difflib fallback), which only decides
  correct (>= 60) or not. Its score is also bucketed with the new grader's
  thresholds for a 3-class comparison.

Writes evals/grading/results/{summary.json, per_item.csv, results.md}.
"""

import argparse
import base64
import csv
import datetime as dt
import json
import os
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "rag_service"))
sys.path.insert(0, str(HERE))

from agreement import LABELS, summarize

from app.db import make_pool
from app.grounded import grade_answer, verdict_for
from app.llm import GeminiLLM
from app.store import ChunkStore

EVAL_USER = "eval"


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def run_new_grader(items, args) -> list[list[dict]]:
    llm = GeminiLLM(
        api_key=os.environ["GOOGLE_API_KEY"],
        model=os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        fallback_model=os.environ.get("GEMINI_FALLBACK_MODEL", "gemini-3.1-flash-lite"),
    )
    runs = []
    with make_pool(args.database_url) as pool:
        store = ChunkStore(pool)
        for r in range(args.repeats):
            out = []
            for it in items:
                hits = store.get_chunks(it["source_chunk_ids"], EVAL_USER)
                if not hits:
                    raise SystemExit(f"{it['id']}: source chunks not found; ingest the eval corpus first")
                g = grade_answer(llm, it["question"], it["reference_answer"], it["key_points"], hits, it["answer"])
                out.append(
                    {"verdict": g.verdict, "score": g.score, "point_status": g.point_status, "feedback": g.feedback}
                )
                print(f"run {r + 1} {it['id']}: {g.verdict} {g.score}", flush=True)
            runs.append(out)
    return runs


def run_legacy_grader(items, python_bin: str) -> list[dict]:
    data = {"answers": [it["answer"] for it in items], "correct_answers": [it["reference_answer"] for it in items]}
    env = {**os.environ, "GEMINI_MODEL": os.environ.get("GEMINI_MODEL", "gemini-3.5-flash-lite")}
    proc = subprocess.run(
        [python_bin, "python_scripts/evaluate_answers.py", json.dumps(data)],
        cwd=ROOT / "backend", capture_output=True, text=True, env=env, timeout=900,
    )  # fmt: skip
    payload = json.loads(base64.b64decode(proc.stdout.strip().splitlines()[-1]))
    if "error" in payload:
        raise SystemExit(f"legacy grader failed: {payload['error']}")
    out = []
    for e in payload["evaluations"]:
        acc = float(e["accuracy"])
        out.append({
            "binary": "correct" if e["is_correct"] else "not",
            "bucketed": verdict_for(acc / 100),
            "score": acc,
        })  # fmt: skip
    return out


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--items", type=Path, default=HERE / "items.jsonl")
    p.add_argument("--grades", type=Path, default=HERE / "human_grades.jsonl")
    p.add_argument("--repeats", type=int, default=2)
    p.add_argument("--database-url", default=os.environ.get("DATABASE_URL", "postgresql://rag:rag@localhost:5433/rag"))
    p.add_argument(
        "--legacy-python",
        default=os.environ.get("LEGACY_PYTHON", "python"),
        help="python with backend/requirements.txt installed; '' skips the baseline",
    )
    p.add_argument("--out", type=Path, default=HERE / "results")
    args = p.parse_args(argv)

    items = load_jsonl(args.items)
    human = {g["id"]: g["grade"] for g in load_jsonl(args.grades)}
    missing = [it["id"] for it in items if it["id"] not in human]
    if missing:
        raise SystemExit(f"no human grade for {missing}")
    H = [human[it["id"]] for it in items]

    runs = run_new_grader(items, args)
    legacy = run_legacy_grader(items, args.legacy_python) if args.legacy_python else None

    new = [r["verdict"] for r in runs[0]]
    summary = {
        "run_at": dt.datetime.now(dt.UTC).isoformat(timespec="seconds"),
        "n_items": len(items),
        "human_distribution": {lab: H.count(lab) for lab in LABELS},
        "new_grader": {**summarize(H, new), "distribution": {lab: new.count(lab) for lab in LABELS}},
        "new_grader_runs": [summarize(H, [r["verdict"] for r in run]) for run in runs],
        "new_grader_test_retest": (
            round(sum(a["verdict"] == b["verdict"] for a, b in zip(runs[0], runs[1], strict=True)) / len(items), 3)
            if len(runs) > 1 else None
        ),
    }  # fmt: skip
    if legacy:
        lb = [x["binary"] for x in legacy]
        summary["legacy_grader"] = {
            "binary_agreement_correct_vs_not": round(
                sum((h == "correct") == (b == "correct") for h, b in zip(H, lb, strict=True)) / len(items), 3
            ),
            "bucketed_3_class": summarize(H, [x["bucketed"] for x in legacy]),
        }

    by_kind = defaultdict(lambda: {"n": 0, "new_agree": 0, "legacy_binary_agree": 0})
    rows = []
    for i, it in enumerate(items):
        k = by_kind[it["kind"]]
        k["n"] += 1
        k["new_agree"] += new[i] == H[i]
        row = {
            "id": it["id"], "qid": it["qid"], "kind": it["kind"], "human": H[i],
            "new": new[i], "new_score": runs[0][i]["score"], "new_points": "/".join(runs[0][i]["point_status"]),
            "new_run2": runs[1][i]["verdict"] if len(runs) > 1 else "",
            "answer": it["answer"], "feedback": runs[0][i]["feedback"],
        }  # fmt: skip
        if legacy:
            k["legacy_binary_agree"] += (H[i] == "correct") == (legacy[i]["binary"] == "correct")
            row.update(legacy_binary=legacy[i]["binary"], legacy_score=legacy[i]["score"])
        rows.append(row)
    summary["by_kind"] = dict(sorted(by_kind.items()))

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "summary.json").write_text(json.dumps(summary, indent=2))
    with (args.out / "per_item.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
