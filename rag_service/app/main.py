import logging
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from dataclasses import asdict
from typing import Annotated

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, model_validator

from . import __version__
from .auth import require_service_token
from .config import Settings, get_settings
from .embeddings import Embedder, EmbeddingError, build_embedder
from .grounded import Difficulty, generate_questions, grade_answer
from .ingest import OwnershipError, ingest_pdf
from .llm import LLM, LLMError, build_llm
from .pdf import PdfError
from .retrieval import Mode, retrieve
from .source import SourceError, fetch_pdf
from .store import ChunkStore, SearchFilters


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    from .db import make_pool, migrate

    migrate(settings.database_url)
    pool = make_pool(settings.database_url, max_size=settings.db_pool_max)
    app.state.store = ChunkStore(pool)
    app.state.embedder = build_embedder(settings)
    app.state.llm = build_llm(settings)
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


logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("rag")


@app.middleware("http")
async def _timing(request: Request, call_next):
    started = time.monotonic()
    response = await call_next(request)
    if request.url.path != "/health":
        elapsed = time.monotonic() - started
        log.info("%s %s -> %d in %.2fs", request.method, request.url.path, response.status_code, elapsed)
    return response


@app.exception_handler(EmbeddingError)
def _embedding_failed(request: Request, exc: EmbeddingError) -> JSONResponse:
    # Upstream dependency failed: 502, not a generic 500, and no stack trace.
    return JSONResponse(status_code=502, content={"detail": f"embedding provider unavailable: {exc}"})


@app.exception_handler(LLMError)
def _llm_failed(request: Request, exc: LLMError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": f"LLM provider unavailable: {exc}"})


def get_store(request: Request) -> ChunkStore:
    return request.app.state.store


def get_embedder(request: Request) -> Embedder:
    return request.app.state.embedder


def get_llm(request: Request) -> LLM:
    return request.app.state.llm


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


class IngestFromUrlRequest(BaseModel):
    document_id: str = Field(min_length=1, max_length=64)
    user_id: str = Field(min_length=1, max_length=64)
    title: str = Field(default="", max_length=500)
    source_url: str = Field(min_length=1, max_length=4000)


@app.post("/v1/documents/from-url", response_model=IngestResponse, dependencies=[Authed])
def ingest_document_from_url(
    body: IngestFromUrlRequest,
    settings: Settings = Depends(get_settings),
    store: ChunkStore = Depends(get_store),
    embedder: Embedder = Depends(get_embedder),
):
    """Same as POST /v1/documents, but the service downloads the PDF itself from a
    short-lived signed storage URL (no 4.5 MB request-body limit)."""
    try:
        data = fetch_pdf(
            body.source_url,
            [h.strip() for h in settings.source_url_hosts.split(",")],
            settings.max_upload_mb * 1024 * 1024,
        )
    except SourceError as e:
        code = status.HTTP_413_CONTENT_TOO_LARGE if "larger" in str(e) else status.HTTP_422_UNPROCESSABLE_CONTENT
        raise HTTPException(code, str(e)) from None
    try:
        result = ingest_pdf(
            store=store,
            embedder=embedder,
            document_id=body.document_id,
            user_id=body.user_id,
            title=body.title,
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


# -- grounded generation and grading --------------------------------------------


class CitationOut(BaseModel):
    chunk_id: str
    page_start: int
    page_end: int
    page_label_start: str
    page_label_end: str
    snippet: str


class QuestionsRequest(BaseModel):
    user_id: str = Field(min_length=1)
    document_id: str = Field(min_length=1)
    n: int = Field(default=5, ge=1)
    difficulty: Difficulty = Difficulty.medium
    focus_text: str | None = Field(default=None, max_length=8000)
    page_min: int | None = Field(default=None, ge=1)
    page_max: int | None = Field(default=None, ge=1)


class QuestionOut(BaseModel):
    question: str
    reference_answer: str
    key_points: list[str]
    citations: list[CitationOut]


class QuestionsResponse(BaseModel):
    questions: list[QuestionOut]
    insufficient_context: bool
    dropped: int
    retrieved: list[CitationOut]


@app.post("/v1/questions", response_model=QuestionsResponse, dependencies=[Authed])
def create_questions(
    body: QuestionsRequest,
    settings: Settings = Depends(get_settings),
    store: ChunkStore = Depends(get_store),
    embedder: Embedder = Depends(get_embedder),
    llm: LLM = Depends(get_llm),
):
    doc = store.get_document(body.document_id)
    if not doc or doc.user_id != body.user_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "document is not indexed yet")
    n = min(body.n, settings.max_questions)
    filters = SearchFilters(body.user_id, [body.document_id], body.page_min, body.page_max)
    focus = (body.focus_text or "").strip() or None
    query = focus[:2000] if focus else "key concepts, definitions and explanations"
    hits = retrieve(store=store, embedder=embedder, query=query, filters=filters, k=max(6, n + 2))
    if not hits and (body.page_min or body.page_max):
        # The visible pages may be blank (cover, figures): fall back to the whole document.
        hits = retrieve(
            store=store, embedder=embedder, query=query, k=max(6, n + 2),
            filters=SearchFilters(body.user_id, [body.document_id]),
        )  # fmt: skip
    result = generate_questions(llm, hits, n=n, difficulty=body.difficulty.value, focus=focus)
    return QuestionsResponse(
        questions=[QuestionOut(**asdict(q)) for q in result.questions],
        insufficient_context=result.insufficient_context,
        dropped=result.dropped,
        retrieved=[CitationOut(**asdict(c)) for c in result.retrieved],
    )


class GradeItem(BaseModel):
    question: str = Field(min_length=1, max_length=4000)
    reference_answer: str = Field(min_length=1, max_length=8000)
    key_points: list[str] = Field(default_factory=list, max_length=10)
    # Empty for questions made before grounding: graded against the reference only.
    source_chunk_ids: list[str] = Field(default_factory=list, max_length=10)
    answer: str = Field(default="", max_length=8000)


class GradeRequest(BaseModel):
    user_id: str = Field(min_length=1)
    items: list[GradeItem] = Field(min_length=1, max_length=20)


class GradeOut(BaseModel):
    verdict: str
    score: int
    point_status: list[str]
    missing_points: list[str]
    feedback: str
    citations: list[CitationOut]


class GradeResponse(BaseModel):
    results: list[GradeOut]


@app.post("/v1/grade", response_model=GradeResponse, dependencies=[Authed])
def grade(
    body: GradeRequest,
    settings: Settings = Depends(get_settings),
    store: ChunkStore = Depends(get_store),
    llm: LLM = Depends(get_llm),
):
    def one(item: GradeItem):
        hits = store.get_chunks(item.source_chunk_ids, body.user_id)
        if item.source_chunk_ids and not hits:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "source chunks not found for this user")
        return grade_answer(llm, item.question, item.reference_answer, item.key_points, hits, item.answer)

    # Answers are graded independently (one call each) so one answer can't
    # influence another's grade; run them in parallel to keep latency down.
    with ThreadPoolExecutor(max_workers=settings.grade_concurrency) as pool:
        results = list(pool.map(one, body.items))
    return GradeResponse(results=[GradeOut(**asdict(r)) for r in results])
