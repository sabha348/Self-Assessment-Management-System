import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "retrieval"))

from labels import Label, load_labels, resolve_gold_pages
from metrics import first_relevant_rank, is_relevant, mrr_at_k, recall_at_k


def test_relevance_is_page_range_overlap():
    assert is_relevant(3, 3, [3])
    assert is_relevant(2, 4, [4])
    assert not is_relevant(2, 4, [1, 5])


def test_first_relevant_rank():
    ranked = [(10, 10), (4, 5), (5, 5)]
    assert first_relevant_rank(ranked, [5]) == 2
    assert first_relevant_rank(ranked, [99]) is None
    assert first_relevant_rank([], [1]) is None


def test_recall_and_mrr():
    ranks = [1, 3, None, 6]
    assert recall_at_k(ranks, 1) == 0.25
    assert recall_at_k(ranks, 5) == 0.5
    assert recall_at_k(ranks, 10) == 0.75
    assert mrr_at_k(ranks, 5) == pytest.approx((1 + 1 / 3) / 4)
    assert recall_at_k([], 5) == 0.0


def write(tmp_path, rows):
    p = tmp_path / "labels.jsonl"
    p.write_text("\n".join(r if isinstance(r, str) else json.dumps(r) for r in rows))
    return p


def test_load_labels_skips_template_rows_and_comments(tmp_path):
    p = write(
        tmp_path,
        [
            "// comment",
            {"id": "example-1", "doc": "d", "question": "q", "gold_pages": [1]},
            {"id": "q1", "doc": "d", "question": " Real? ", "gold_page_labels": ["iv"], "tags": ["concept"]},
        ],
    )
    [label] = load_labels(p)
    assert label == Label("q1", "d", "Real?", (), ("iv",), ("concept",))


@pytest.mark.parametrize(
    "row,msg",
    [
        ({"id": "a", "doc": "d", "question": "q"}, "gold_pages"),
        ({"id": "a", "doc": "d", "gold_pages": [1]}, "question"),
    ],
)
def test_load_labels_validates(tmp_path, row, msg):
    with pytest.raises(ValueError, match=msg):
        load_labels(write(tmp_path, [row]))


def test_duplicate_ids_rejected(tmp_path):
    row = {"id": "a", "doc": "d", "question": "q", "gold_pages": [1]}
    with pytest.raises(ValueError, match="duplicate"):
        load_labels(write(tmp_path, [row, row]))


def test_resolve_gold_pages_maps_printed_labels():
    label = Label("a", "d", "q", gold_pages=(1,), gold_page_labels=("12",))
    assert resolve_gold_pages(label, {"12": [32]}, 100) == [1, 32]
    with pytest.raises(ValueError, match="not found"):
        resolve_gold_pages(Label("a", "d", "q", gold_page_labels=("999",)), {}, 100)
    with pytest.raises(ValueError, match="outside"):
        resolve_gold_pages(Label("a", "d", "q", gold_pages=(500,)), {}, 100)


def test_plain_text_labels(tmp_path):
    p = tmp_path / "labels.txt"
    p.write_text("# my labels\n\n45, 46 | What does `in` do on a dict? | concept,dict\n12 | What is a variable?\n")
    a, b = load_labels(p)
    assert (a.id, a.doc, a.gold_pages, a.tags) == ("q003", "thinkpython2", (45, 46), ("concept", "dict"))
    assert a.question == "What does `in` do on a dict?"
    assert (b.id, b.gold_pages, b.tags) == ("q004", (12,), ())


@pytest.mark.parametrize("line", ["no separator here", "12 |", "twelve | question?"])
def test_plain_text_labels_validation(tmp_path, line):
    p = tmp_path / "labels.txt"
    p.write_text(line)
    with pytest.raises(ValueError):
        load_labels(p)
