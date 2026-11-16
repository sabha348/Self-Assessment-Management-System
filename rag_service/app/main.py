from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator

from . import __version__
from .auth import require_service_token
from .config import Settings, get_settings
from .embeddings import Embedder, EmbeddingError, build_embedder
from .ingest import OwnershipError, ingest_pdf
from .pdf import PdfError
from .retrieval import Mode, retrieve
from .store import ChunkStore, SearchFilters


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    from .db import make_pool, migrate

    migrate(settings.database_url)
    pool = make_pool(settings.database_url)
    app.state.store = ChunkStore(pool)
    app.state.embedder = build_embedder(settings)
    try:
        yield
    finally:
        pool.close()


app = FastAPI(
    title="SmartAssess RAG service",
    version=__version__,
    description="PDF ingestion with page-aware chunking, embeddings in pgvector, and top-k retrieval.",
    lifespan=lifespan,
)


@app.exception_handler(EmbeddingError)
def _embedding_failed(request: Request, exc: EmbeddingError) -> JSONResponse:
    # Upstream dependency failed: 502, not a generic 500, and no stack trace.
    return JSONResponse(status_code=502, content={"detail": f"embedding provider unavailable: {exc}"})


def get_store(request: Request) -> ChunkStore:
    return request.app.state.store


def get_embedder(request: Request) -> Embedder:
    return request.app.state.embedder


Authed = Depends(require_service_token)


# -- schemas -------------------------------------------------------------------


class IngestResponse(BaseModel):
    document_id: str
    pages: int
    chunks: int
    skipped: bool


class RetrieveRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    user_id: str = Field(min_length=1)
    document_ids: list[str] | None = None
    k: int | None = Field(default=None, ge=1)
    mode: Mode = Mode.dense
    page_min: int | None = Field(default=None, ge=1)
    page_max: int | None = Field(default=None, ge=1)

    @model_validator(mode="after")
    def _pages_in_order(self):
        if self.page_min and self.page_max and self.page_min > self.page_max:
            raise ValueError("page_min must be <= page_max")
        return self


class ChunkOut(BaseModel):
    chunk_id: str
    document_id: str
    chunk_index: int
    page_start: int
    page_end: int
    page_label_start: str
    page_label_end: str
    text: str
    score: float


class RetrieveResponse(BaseModel):
    query: str
    mode: Mode
    chunks: list[ChunkOut]


# -- routes --------------------------------------------------------------------


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.post("/v1/documents", response_model=IngestResponse, dependencies=[Authed])
def ingest_document(
    file: Annotated[UploadFile, File(description="PDF file")],
    document_id: Annotated[str, Form(min_length=1, max_length=64)],
    user_id: Annotated[str, Form(min_length=1, max_length=64)],
    title: Annotated[str, Form(max_length=500)] = "",
    settings: Settings = Depends(get_settings),
    store: ChunkStore = Depends(get_store),
    embedder: Embedder = Depends(get_embedder),
):
    limit = settings.max_upload_mb * 1024 * 1024
    data = file.file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, f"PDF larger than {settings.max_upload_mb} MB")
    try:
        result = ingest_pdf(
            store=store,
            embedder=embedder,
            document_id=document_id,
            user_id=user_id,
            title=title or (file.filename or ""),
            data=data,
            chunk_size=settings.chunk_size,
            chunk_overlap=settings.chunk_overlap,
        )
    except OwnershipError:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "document belongs to another user") from None
    except PdfError as e:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(e)) from None
    return IngestResponse(**result.__dict__)


@app.delete("/v1/documents/{document_id}", status_code=204, dependencies=[Authed])
def delete_document(
    document_id: str,
    user_id: Annotated[str, Query(min_length=1)],
    store: ChunkStore = Depends(get_store),
):
    if not store.delete_document(document_id, user_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "document not found")


@app.post("/v1/retrieve", response_model=RetrieveResponse, dependencies=[Authed])
def retrieve_chunks(
    body: RetrieveRequest,
    settings: Settings = Depends(get_settings),
    store: ChunkStore = Depends(get_store),
    embedder: Embedder = Depends(get_embedder),
):
    k = min(body.k or settings.default_top_k, settings.max_top_k)
    hits = retrieve(
        store=store,
        embedder=embedder,
        query=body.query,
        filters=SearchFilters(body.user_id, body.document_ids, body.page_min, body.page_max),
        k=k,
        mode=body.mode,
    )
    return RetrieveResponse(query=body.query, mode=body.mode, chunks=[ChunkOut(**h.__dict__) for h in hits])
