from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Service configuration, read from environment variables (or a .env file)."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Postgres with the pgvector extension.
    database_url: str = "postgresql://rag:rag@localhost:5433/rag"

    # Shared secret the Node backend sends in X-Service-Token. Required in
    # production; an empty value is only accepted when ALLOW_NO_AUTH=true.
    service_token: str = ""
    allow_no_auth: bool = False

    # Embeddings.
    google_api_key: str = Field(default="", validation_alias="GOOGLE_API_KEY")
    embedding_model: str = "gemini-embedding-001"
    embedding_dim: int = 768  # must match the vector(N) column in migrations
    embedding_batch_size: int = 64
    # Texts embedded per minute (0 = unlimited). Gemini's free tier allows 100.
    embedding_max_per_minute: int = 90

    # Generation / grading model (same env var as the Node backend).
    llm_model: str = Field(default="gemini-3.5-flash-lite", validation_alias="GEMINI_MODEL")
    # Used once when the primary model stays overloaded (503/429) through all retries. "" disables.
    llm_fallback_model: str = Field(default="gemini-3.1-flash-lite", validation_alias="GEMINI_FALLBACK_MODEL")
    llm_timeout_s: float = 45.0  # per model call; on timeout the fallback model is tried
    max_questions: int = 10
    grade_concurrency: int = 4

    # Chunking (characters; ~4 characters per English token).
    chunk_size: int = 1500
    chunk_overlap: int = 200

    # Uploads.
    max_upload_mb: int = 25
    # Hosts /v1/documents/from-url may download from (comma-separated suffixes).
    source_url_hosts: str = "blob.vercel-storage.com"
    # Connection pool size per instance (serverless: keep small; Neon free has ~100 connections).
    db_pool_max: int = 3

    # Retrieval.
    default_top_k: int = 5
    max_top_k: int = 50


@lru_cache
def get_settings() -> Settings:
    return Settings()
