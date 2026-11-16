from fastapi import FastAPI

from . import __version__

app = FastAPI(
    title="SmartAssess RAG service",
    version=__version__,
    description="PDF ingestion with page-aware chunking, embeddings in pgvector, and top-k retrieval.",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}
