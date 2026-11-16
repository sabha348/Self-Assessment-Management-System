"""Top-k retrieval: dense, keyword, or hybrid (reciprocal rank fusion)."""

from dataclasses import replace
from enum import StrEnum

from .embeddings import Embedder
from .store import ChunkStore, Hit, SearchFilters


class Mode(StrEnum):
    dense = "dense"
    keyword = "keyword"
    hybrid = "hybrid"


RRF_K = 60  # standard constant from Cormack et al. (2009)


def reciprocal_rank_fusion(rankings: list[list[Hit]], k: int, rrf_k: int = RRF_K) -> list[Hit]:
    """Merge ranked lists by summing 1 / (rrf_k + rank). Rank-based, so it
    needs no calibration between cosine similarities and ts_rank scores."""
    scores: dict[str, float] = {}
    first_seen: dict[str, Hit] = {}
    for ranking in rankings:
        for rank, hit in enumerate(ranking, start=1):
            scores[hit.chunk_id] = scores.get(hit.chunk_id, 0.0) + 1.0 / (rrf_k + rank)
            first_seen.setdefault(hit.chunk_id, hit)
    ordered = sorted(scores, key=lambda cid: scores[cid], reverse=True)[:k]
    return [replace(first_seen[cid], score=scores[cid]) for cid in ordered]


def retrieve(
    *,
    store: ChunkStore,
    embedder: Embedder,
    query: str,
    filters: SearchFilters,
    k: int,
    mode: Mode = Mode.dense,
    candidates: int | None = None,
) -> list[Hit]:
    if mode is Mode.dense:
        return store.search_dense(embedder.embed_query(query), filters, k)
    if mode is Mode.keyword:
        return store.search_keyword(query, filters, k)
    n = candidates or max(4 * k, 20)  # fuse from a deeper pool than we return
    dense = store.search_dense(embedder.embed_query(query), filters, n)
    keyword = store.search_keyword(query, filters, n)
    return reciprocal_rank_fusion([dense, keyword], k)
