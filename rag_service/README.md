# RAG service

FastAPI service that turns PDFs into page-aware chunks, embeds them with
Gemini, stores them in Postgres + pgvector, and returns the top-k chunks for
a question. Only the Node backend calls it (shared `X-Service-Token`); the
backend authenticates end users and passes the verified `user_id`.

```
PDF ──pypdf──▶ pages (number + printed label) ──chunker──▶ chunks with page_start/page_end
      ──Gemini embeddings (768-d, normalised)──▶ pgvector (HNSW, cosine) + tsvector (FTS)
query ──▶ dense | keyword | hybrid (RRF) ──▶ top-k chunks with page citations
```

## API

| Method | Path | Body | Notes |
|---|---|---|---|
| `GET` | `/health` | | no auth |
| `POST` | `/v1/documents` | multipart: `file`, `document_id`, `user_id`, `title` | idempotent: same bytes + model + chunking → `skipped: true` |
| `DELETE` | `/v1/documents/{id}?user_id=` | | 404 unless the user owns it |
| `POST` | `/v1/retrieve` | `{query, user_id, document_ids?, k?, mode?, page_min?, page_max?}` | `mode`: `dense` (default), `keyword`, `hybrid` |

Errors: 401 bad token, 403 document owned by another user, 413 file too
large, 422 not a readable PDF / no text, 502 embedding provider down.
Interactive docs at `/docs`.

## Configuration

| Variable | Default | |
|---|---|---|
| `DATABASE_URL` | `postgresql://rag:rag@localhost:5433/rag` | Postgres with pgvector ≥ 0.8 |
| `SERVICE_TOKEN` | (required) | shared secret with the backend |
| `GOOGLE_API_KEY` | (required) | Gemini |
| `EMBEDDING_MODEL` / `EMBEDDING_DIM` | `gemini-embedding-001` / `768` | dim must match `vector(768)` in the migration |
| `EMBEDDING_MAX_PER_MINUTE` | `90` | free tier allows 100 texts/min; `0` = unlimited |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | `1500` / `200` | characters |
| `MAX_UPLOAD_MB` | `25` | |

Migrations in `migrations/` run automatically at start-up.

## Run and test

```bash
# from the repo root
GOOGLE_API_KEY=... SERVICE_TOKEN=dev-token docker compose -f compose.dev.yml up --build

# tests (DB tests need a pgvector database; they are skipped otherwise)
cd rag_service
pip install -r requirements-dev.txt
TEST_DATABASE_URL=postgresql://rag:rag@localhost:5433/rag_test pytest
ruff check . && ruff format --check .
```

Tests use a deterministic bag-of-words embedder, so they run offline; the
Gemini client itself is tested with a fake client (batching, normalisation,
retry, rate limiting).
