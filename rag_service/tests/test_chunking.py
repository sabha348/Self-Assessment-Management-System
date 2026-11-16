import re

import pytest

from app.chunking import chunk_pages, join_pages
from app.pdf import Page


def pages_from(texts):
    return [Page(number=i + 1, label=str(i + 1), text=t) for i, t in enumerate(texts)]


def sentences(tag, n, words=12):
    """n distinct sentences, each tagged so we can tell where text came from."""
    return " ".join(f"{tag}{k} " + " ".join(["word"] * words) + "." for k in range(n))


def test_each_chunk_is_an_exact_slice_and_respects_size():
    pages = pages_from([sentences("a", 40), sentences("b", 40), sentences("c", 40)])
    doc = join_pages(pages)
    chunks = chunk_pages(pages, size=500, overlap=100)
    assert len(chunks) > 3
    for c in chunks:
        assert doc.text[c.char_start : c.char_end] == c.text
        assert len(c.text) <= 500
        assert c.text == c.text.strip()
    assert [c.index for c in chunks] == list(range(len(chunks)))


def test_page_ranges_match_where_the_text_came_from():
    pages = pages_from([sentences("a", 30), sentences("b", 30), sentences("c", 30)])
    for c in chunk_pages(pages, size=400, overlap=80):
        tags = set(re.findall(r"\b([abc])\d+\b", c.text))
        pages_seen = {"abc".index(t) + 1 for t in tags}
        assert min(pages_seen) == c.page_start
        assert max(pages_seen) == c.page_end


def test_a_chunk_can_span_a_page_break_and_reports_both_pages():
    pages = pages_from(["Short end of page one.", "Start of page two continues here."])
    [chunk] = chunk_pages(pages, size=1000, overlap=0)
    assert (chunk.page_start, chunk.page_end) == (1, 2)


def test_every_word_is_covered_by_some_chunk():
    pages = pages_from([sentences("a", 25), "", sentences("c", 25)])
    chunks = chunk_pages(pages, size=300, overlap=50)
    covered = " ".join(c.text for c in chunks)
    for tag in [f"a{k}" for k in range(25)] + [f"c{k}" for k in range(25)]:
        assert re.search(rf"\b{tag}\b", covered), tag


def test_neighbouring_chunks_overlap_but_always_make_progress():
    pages = pages_from([sentences("a", 60)])
    chunks = chunk_pages(pages, size=400, overlap=120)
    for prev, cur in zip(chunks, chunks[1:], strict=False):
        assert cur.char_start > prev.char_start
        assert cur.char_start <= prev.char_end  # overlap or adjacency, never a gap...
        gap_text = join_pages(pages).text[prev.char_end : cur.char_start]
        assert gap_text.strip() == ""  # ...other than whitespace
    overlapping = sum(cur.char_start < prev.char_end for prev, cur in zip(chunks, chunks[1:], strict=False))
    assert overlapping >= len(chunks) // 2


def test_no_overlap_means_disjoint_chunks():
    chunks = chunk_pages(pages_from([sentences("a", 40)]), size=300, overlap=0)
    for prev, cur in zip(chunks, chunks[1:], strict=False):
        assert cur.char_start >= prev.char_end


def test_overlong_word_is_hard_split():
    chunks = chunk_pages(pages_from(["x" * 1000]), size=300, overlap=0)
    assert [len(c.text) for c in chunks] == [300, 300, 300, 100]


def test_empty_and_blank_pages_give_no_chunks_but_keep_numbering():
    assert chunk_pages(pages_from(["", "   "])) == []
    chunks = chunk_pages(pages_from(["", "", "Only page three has text."]))
    assert [(c.page_start, c.page_end) for c in chunks] == [(3, 3)]


def test_labels_are_carried_through():
    pages = [Page(1, "xi", "Preface words."), Page(2, "1", "Chapter words.")]
    [c] = chunk_pages(pages, size=1000, overlap=0)
    assert (c.page_label_start, c.page_label_end) == ("xi", "1")


@pytest.mark.parametrize("size,overlap", [(0, 0), (100, 100), (100, -1)])
def test_invalid_config(size, overlap):
    with pytest.raises(ValueError):
        chunk_pages(pages_from(["text"]), size=size, overlap=overlap)
