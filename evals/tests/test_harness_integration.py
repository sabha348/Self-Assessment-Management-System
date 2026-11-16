"""Runs the whole retrieval harness on a synthetic 4-page PDF with a
deterministic fake embedder. Needs TEST_DATABASE_URL (Postgres+pgvector)."""

import json
import os

import psycopg
import pytest
import run_retrieval_eval
from tests.fakes import KeywordEmbedder  # rag_service/tests
from tests.pdf_factory import make_pdf

DB = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DB, reason="TEST_DATABASE_URL not set")

PAGES = [
    "Variables. An assignment statement creates a new variable and gives it a value.",
    "Functions. A function is a named sequence of statements that performs a computation.",
    "Iteration. A while loop repeats its body until the condition becomes false.",
    "Recursion. A recursive function calls itself and needs a base case to stop.",
]


def test_harness_end_to_end(tmp_path, capsys):
    with psycopg.connect(DB, autocommit=True) as conn:
        conn.execute("DROP TABLE IF EXISTS chunks, documents, schema_migrations CASCADE")
    corpus = tmp_path / "corpus"
    corpus.mkdir()
    (corpus / "mini.pdf").write_bytes(make_pdf(PAGES))
    labels = tmp_path / "labels.jsonl"
    rows = [
        {"id": "example-ignored", "doc": "mini", "question": "x", "gold_pages": [1]},
        {"id": "loop", "doc": "mini", "question": "what does a while loop repeat", "gold_pages": [3]},
        {"id": "base", "doc": "mini", "question": "recursive base case", "gold_page_labels": ["4"], "tags": ["t"]},
        {"id": "miss", "doc": "mini", "question": "assignment statement variable", "gold_pages": [2]},
    ]
    labels.write_text("\n".join(json.dumps(r) for r in rows))
    out = tmp_path / "runs"
    argv = [
        "--labels",
        str(labels),
        "--corpus",
        str(corpus),
        "--database-url",
        DB,
        "--chunk-size",
        "100",
        "--chunk-overlap",
        "0",
        "--out",
        str(out),
        "--modes",
        "dense,keyword",
    ]
    assert run_retrieval_eval.main(argv, embedder=KeywordEmbedder()) == 0

    [run_dir] = list(out.iterdir())
    summary = json.loads((run_dir / "summary.json").read_text())
    assert summary["n_questions"] == 3
    # 'loop' and 'base' hit page 1 of the ranking; 'miss' is deliberately labelled
    # with the wrong page, so it can only be found lower down (rank 2+).
    for mode in ("dense", "keyword"):
        assert summary["modes"][mode]["recall@1"] == round(2 / 3, 3)  # summary is rounded
    assert summary["by_tag"]["t"]["n"] == 1
    assert (run_dir / "per_question.csv").read_text().count("\n") == 4

    # Second run re-uses the ingested document (no re-embedding).
    emb = KeywordEmbedder()
    run_retrieval_eval.main(argv, embedder=emb)
    assert emb.document_calls == 0
    assert "cached" in capsys.readouterr().out
