"""pgvector-backed storage for documents and their chunks."""

import hashlib
import re
from collections.abc import Sequence
from dataclasses import dataclass

import numpy as np
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from .chunking import Chunk


@dataclass(frozen=True)
class DocumentRecord:
    id: str
    user_id: str
    title: str
    sha256: str
    page_count: int
    chunk_count: int
    embedding_model: str
    chunk_size: int
    chunk_overlap: int


@dataclass(frozen=True)
class SearchFilters:
    user_id: str
    document_ids: Sequence[str] | None = None
    page_min: int | None = None  # keep chunks that touch [page_min, page_max]
    page_max: int | None = None


@dataclass(frozen=True)
class Hit:
    chunk_id: str
    document_id: str
    chunk_index: int
    page_start: int
    page_end: int
    page_label_start: str
    page_label_end: str
    text: str
    score: float  # cosine similarity (dense) or ts_rank_cd (keyword)


def chunk_id(document_id: str, chunk: Chunk) -> str:
    h = hashlib.sha256(f"{document_id}\x00{chunk.index}\x00{chunk.text}".encode())
    return h.hexdigest()[:32]


_HIT_COLUMNS = "id AS chunk_id, document_id, chunk_index, page_start, page_end, page_label_start, page_label_end, text"


def _where(f: SearchFilters) -> tuple[str, list]:
    clauses, params = ["user_id = %s"], [f.user_id]
    if f.document_ids:
        clauses.append("document_id = ANY(%s)")
        params.append(list(f.document_ids))
    if f.page_min is not None:
        clauses.append("page_end >= %s")
        params.append(f.page_min)
    if f.page_max is not None:
        clauses.append("page_start <= %s")
        params.append(f.page_max)
    return " AND ".join(clauses), params


class ChunkStore:
    def __init__(self, pool: ConnectionPool, ef_search: int = 100):
        self.pool = pool
        self.ef_search = ef_search

    # -- documents ---------------------------------------------------------

    def get_document(self, document_id: str) -> DocumentRecord | None:
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            row = cur.execute(
                "SELECT id, user_id, title, sha256, page_count, chunk_count, embedding_model,"
                " chunk_size, chunk_overlap FROM documents WHERE id = %s",
                (document_id,),
            ).fetchone()
        return DocumentRecord(**row) if row else None

    def replace_document(self, doc: DocumentRecord, chunks: Sequence[Chunk], embeddings: np.ndarray) -> None:
        """Atomically replace a document and all its chunks. Readers see either
        the old version or the new one, never a half-ingested document."""
        if len(chunks) != len(embeddings):
            raise ValueError("chunks and embeddings differ in length")
        with self.pool.connection() as conn, conn.transaction():
            conn.execute("DELETE FROM documents WHERE id = %s", (doc.id,))  # cascades to chunks
            conn.execute(
                "INSERT INTO documents (id, user_id, title, sha256, page_count, chunk_count,"
                " embedding_model, chunk_size, chunk_overlap) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    doc.id,
                    doc.user_id,
                    doc.title,
                    doc.sha256,
                    doc.page_count,
                    doc.chunk_count,
                    doc.embedding_model,
                    doc.chunk_size,
                    doc.chunk_overlap,
                ),
            )
            with conn.cursor() as cur:
                cur.executemany(
                    "INSERT INTO chunks (id, document_id, user_id, chunk_index, page_start, page_end,"
                    " page_label_start, page_label_end, char_start, char_end, text, embedding)"
                    " VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                    [
                        (
                            chunk_id(doc.id, c),
                            doc.id,
                            doc.user_id,
                            c.index,
                            c.page_start,
                            c.page_end,
                            c.page_label_start,
                            c.page_label_end,
                            c.char_start,
                            c.char_end,
                            c.text,
                            np.asarray(e, dtype=np.float32),
                        )
                        for c, e in zip(chunks, embeddings, strict=True)
                    ],
                )

    def delete_document(self, document_id: str, user_id: str) -> bool:
        with self.pool.connection() as conn:
            cur = conn.execute("DELETE FROM documents WHERE id = %s AND user_id = %s", (document_id, user_id))
            return cur.rowcount > 0

    def count_chunks(self, document_id: str) -> int:
        with self.pool.connection() as conn:
            return conn.execute("SELECT count(*) FROM chunks WHERE document_id = %s", (document_id,)).fetchone()[0]

    def get_chunks(self, chunk_ids: Sequence[str], user_id: str) -> list[Hit]:
        """Chunks by id, in the order asked, only if they belong to user_id."""
        if not chunk_ids:
            return []
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            rows = cur.execute(
                f"SELECT {_HIT_COLUMNS}, 1.0 AS score FROM chunks WHERE id = ANY(%s) AND user_id = %s",
                (list(chunk_ids), user_id),
            ).fetchall()
        by_id = {r["chunk_id"]: Hit(**r) for r in rows}
        return [by_id[c] for c in dict.fromkeys(chunk_ids) if c in by_id]

    # -- search ------------------------------------------------------------

    def search_dense(self, query_vec: np.ndarray, filters: SearchFilters, k: int) -> list[Hit]:
        where, params = _where(filters)
        sql = (
            f"SELECT {_HIT_COLUMNS}, 1 - (embedding <=> %s) AS score FROM chunks"
            f" WHERE {where} ORDER BY embedding <=> %s LIMIT %s"
        )
        q = np.asarray(query_vec, dtype=np.float32)
        with self.pool.connection() as conn, conn.transaction():
            # With a WHERE filter, a plain HNSW scan can return fewer than k rows
            # (it filters *after* collecting ef_search candidates). Iterative scans
            # (pgvector >= 0.8) keep scanning until k rows pass the filter.
            conn.execute(f"SET LOCAL hnsw.ef_search = {int(self.ef_search)}")
            conn.execute("SET LOCAL hnsw.iterative_scan = relaxed_order")
            with conn.cursor(row_factory=dict_row) as cur:
                rows = cur.execute(sql, [q, *params, q, k]).fetchall()
        hits = [Hit(**r) for r in rows]
        # relaxed_order may return rows slightly out of order; fix that here.
        return sorted(hits, key=lambda h: h.score, reverse=True)

    def search_keyword(self, query: str, filters: SearchFilters, k: int) -> list[Hit]:
        # OR the query words together: a question rarely contains every term of
        # the passage that answers it, so an AND query (plainto_tsquery) is too
        # strict. Words are reduced to [a-z0-9] so the tsquery syntax can't break.
        terms = re.findall(r"[a-z0-9]+", query.lower())
        if not terms:
            return []
        where, params = _where(filters)
        sql = (
            f"SELECT {_HIT_COLUMNS}, ts_rank_cd(tsv, q) AS score"
            f" FROM chunks, to_tsquery('english', %s) AS q"
            f" WHERE {where} AND tsv @@ q ORDER BY score DESC, chunk_index LIMIT %s"
        )
        with self.pool.connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            rows = cur.execute(sql, [" | ".join(terms), *params, k]).fetchall()
        return [Hit(**r) for r in rows]
