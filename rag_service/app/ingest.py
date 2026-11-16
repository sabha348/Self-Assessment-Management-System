"""PDF -> pages -> chunks -> embeddings -> pgvector."""

import hashlib
from dataclasses import dataclass

from .chunking import chunk_pages
from .embeddings import Embedder
from .pdf import extract_pages
from .store import ChunkStore, DocumentRecord


class OwnershipError(PermissionError):
    """The document id already belongs to a different user."""


@dataclass(frozen=True)
class IngestResult:
    document_id: str
    pages: int
    chunks: int
    skipped: bool  # True when identical content was already ingested with the same settings


def ingest_pdf(
    *,
    store: ChunkStore,
    embedder: Embedder,
    document_id: str,
    user_id: str,
    title: str,
    data: bytes,
    chunk_size: int,
    chunk_overlap: int,
) -> IngestResult:
    sha = hashlib.sha256(data).hexdigest()
    existing = store.get_document(document_id)
    if existing and existing.user_id != user_id:
        raise OwnershipError(document_id)
    if (
        existing
        and existing.sha256 == sha
        and existing.embedding_model == embedder.name
        and (existing.chunk_size, existing.chunk_overlap) == (chunk_size, chunk_overlap)
    ):
        # Same bytes, same model, same chunking: nothing would change, and
        # skipping avoids paying for the embeddings again.
        return IngestResult(document_id, existing.page_count, existing.chunk_count, skipped=True)

    pages = extract_pages(data)
    chunks = chunk_pages(pages, size=chunk_size, overlap=chunk_overlap)
    # Embed before opening the write transaction: a slow or failing API call
    # must not hold locks or leave the old version deleted.
    vectors = embedder.embed_documents([c.text for c in chunks])
    record = DocumentRecord(
        id=document_id,
        user_id=user_id,
        title=title,
        sha256=sha,
        page_count=len(pages),
        chunk_count=len(chunks),
        embedding_model=embedder.name,
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
    )
    store.replace_document(record, chunks, vectors)
    return IngestResult(document_id, len(pages), len(chunks), skipped=False)
