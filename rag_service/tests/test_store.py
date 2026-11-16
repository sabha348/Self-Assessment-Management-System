import numpy as np
import pytest

from app.chunking import chunk_pages
from app.db import migrate
from app.pdf import Page
from app.store import DocumentRecord, SearchFilters
from tests.fakes import KeywordEmbedder

pytestmark = pytest.mark.db
EMB = KeywordEmbedder()


def ingest(store, doc_id, user_id, page_texts, title="t", size=300):
    pages = [Page(i + 1, str(i + 1), t) for i, t in enumerate(page_texts)]
    chunks = chunk_pages(pages, size=size, overlap=0)
    vecs = EMB.embed_documents([c.text for c in chunks])
    rec = DocumentRecord(doc_id, user_id, title, "sha-" + doc_id, len(pages), len(chunks), EMB.name, 300, 0)
    store.replace_document(rec, chunks, vecs)
    return chunks


def test_migrate_is_idempotent(database_url):
    assert migrate(database_url) == ["001_init.sql"]
    assert migrate(database_url) == []


def test_replace_document_swaps_all_chunks(store):
    ingest(store, "d1", "u1", ["alpha " * 200, "beta " * 200])
    first = store.count_chunks("d1")
    assert first > 2
    ingest(store, "d1", "u1", ["gamma only"])
    assert store.count_chunks("d1") == 1
    assert store.get_document("d1").page_count == 1


def test_replace_rejects_mismatched_lengths(store):
    pages = [Page(1, "1", "some text")]
    chunks = chunk_pages(pages)
    rec = DocumentRecord("d", "u", "", "s", 1, 1, "m", 1, 0)
    with pytest.raises(ValueError):
        store.replace_document(rec, chunks, np.zeros((0, 768)))


def test_delete_requires_the_owner(store):
    ingest(store, "d1", "owner", ["text"])
    assert store.delete_document("d1", "someone-else") is False
    assert store.get_document("d1") is not None
    assert store.delete_document("d1", "owner") is True
    assert store.get_document("d1") is None
    assert store.count_chunks("d1") == 0  # cascade


def test_dense_search_ranks_the_matching_page_first(store):
    ingest(
        store,
        "d1",
        "u1",
        [
            "Variables store values. An assignment statement creates a variable.",
            "A while loop repeats a block of statements until its condition is false.",
            "Recursion is when a function calls itself; a base case stops it.",
        ],
        size=80,
    )
    hits = store.search_dense(EMB.embed_query("while loop condition repeats"), SearchFilters("u1"), k=3)
    assert hits[0].page_start == 2
    assert [h.score for h in hits] == sorted([h.score for h in hits], reverse=True)


def test_search_never_crosses_users(store):
    ingest(store, "mine", "u1", ["recursion base case function"])
    ingest(store, "theirs", "u2", ["recursion base case function"])
    hits = store.search_dense(EMB.embed_query("recursion"), SearchFilters("u1"), k=10)
    assert {h.document_id for h in hits} == {"mine"}
    kw = store.search_keyword("recursion", SearchFilters("u1"), k=10)
    assert {h.document_id for h in kw} == {"mine"}


def test_filtered_search_still_returns_k_rows(store):
    # Many near-duplicate chunks for another user crowd the HNSW candidate list;
    # iterative scanning must still find k rows for the filtered user.
    for i in range(30):
        ingest(store, f"other{i}", "other", ["loop " * 60 + f"filler {i} " * 60])
    ingest(store, "mine", "me", [f"loop topic number {i}. " * 15 for i in range(8)])
    hits = store.search_dense(EMB.embed_query("loop"), SearchFilters("me"), k=5)
    assert len(hits) == 5
    assert {h.document_id for h in hits} == {"mine"}


def test_document_and_page_filters(store):
    ingest(store, "a", "u", ["loop one", "loop two", "loop three"], size=10)
    ingest(store, "b", "u", ["loop elsewhere"])
    hits = store.search_dense(EMB.embed_query("loop"), SearchFilters("u", document_ids=["a"]), k=10)
    assert {h.document_id for h in hits} == {"a"}
    paged = store.search_dense(
        EMB.embed_query("loop"), SearchFilters("u", document_ids=["a"], page_min=2, page_max=2), k=10
    )
    assert all(h.page_start <= 2 <= h.page_end for h in paged) and paged


def test_keyword_search_stems_and_ors_terms(store):
    ingest(store, "d", "u", ["The interpreter executes loops.", "Nothing relevant here at all."])
    hits = store.search_keyword("How does a loop work in an interpreter?", SearchFilters("u"), k=5)
    assert hits and hits[0].page_start == 1
    assert store.search_keyword("?!", SearchFilters("u"), k=5) == []
