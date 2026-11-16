"""Retrieval metrics on page-level gold labels.

A retrieved chunk is relevant if its page range [page_start, page_end]
overlaps any gold page. Page-level labels stay valid when chunking changes,
so the same labels can compare chunk sizes, embedders and retrieval modes.
"""

from collections.abc import Iterable, Sequence


def is_relevant(page_start: int, page_end: int, gold_pages: Iterable[int]) -> bool:
    return any(page_start <= p <= page_end for p in gold_pages)


def first_relevant_rank(ranked: Sequence[tuple[int, int]], gold_pages: Iterable[int]) -> int | None:
    """1-based rank of the first relevant chunk, or None."""
    gold = list(gold_pages)
    for rank, (start, end) in enumerate(ranked, start=1):
        if is_relevant(start, end, gold):
            return rank
    return None


def recall_at_k(first_ranks: Sequence[int | None], k: int) -> float:
    """Share of questions with at least one relevant chunk in the top k
    (a.k.a. hit rate@k, the usual 'recall@k' for single-answer QA)."""
    if not first_ranks:
        return 0.0
    return sum(r is not None and r <= k for r in first_ranks) / len(first_ranks)


def mrr_at_k(first_ranks: Sequence[int | None], k: int) -> float:
    if not first_ranks:
        return 0.0
    return sum(1.0 / r for r in first_ranks if r is not None and r <= k) / len(first_ranks)
