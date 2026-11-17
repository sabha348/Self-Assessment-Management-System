# SmartAssess

A self-study platform: upload a PDF, read it, and answer questions generated **only from the pages
you are reading**, with page citations on every question and on every piece of grading feedback.
Progress is tracked from subject down to concept level.

MERN app + a Python **RAG service** (FastAPI, pgvector, Gemini), with evals for retrieval and grading.

| Questions cite the pages they come from | Grading: verdict, feedback, and a link back to the page |
|---|---|
| ![Generated questions with page citations](docs/screenshots/grounded-questions.png) | ![Graded answers with feedback and Review links](docs/screenshots/grounded-results.png) |

## Results

**Retrieval** (42 hand-labelled questions over a 244-page textbook; details in
[`evals/results/retrieval.md`](evals/results/retrieval.md)):

| mode | recall@1 | **recall@5** | MRR@5 |
|---|---|---|---|
| dense (pgvector, Gemini embeddings) | 0.81 | **1.00** (42/42, 95% CI 0.92–1.00) | 0.90 |
| keyword (Postgres FTS) | 0.24 | 0.74 | 0.42 |
| hybrid (reciprocal rank fusion) | 0.62 | 0.91 | 0.75 |

Hybrid was *worse* than dense here (the keyword ranking adds noise), so the service defaults to dense.

**Grading** (auto-grader vs. the owner's blind hand grades on 30 answers; details in
[`evals/grading/results/results.md`](evals/grading/results/results.md)):

| grader | exact agreement | Cohen's κ | weighted κ | correct vs. not | correct↔incorrect errors |
|---|---|---|---|---|---|
| **new: point-based, grounded** | **0.77** | **0.65** | **0.84** | **0.97** | **0** |
| old: holistic score + regex | 0.63 | 0.45 | 0.54 | 0.80 | 2 |

The new grader never confuses a correct answer with a wrong one; its misses are one step apart,
mostly being stricter than a human on short, vague answers. 27/30 verdicts were identical across two runs.

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[React app<br/>PDF viewer, quizzes, analytics]
  end
  subgraph Node["Node / Express API"]
    API[Auth JWT<br/>quizzes, practice, analytics]
    IDX[Background indexer]
    GR[Grader router]
  end
  subgraph RAG["RAG service (FastAPI)"]
    ING[Ingest:<br/>pypdf → page-aware chunks]
    RET[Retrieve top-k<br/>dense / keyword / hybrid]
    GEN[Grounded question<br/>generation]
    GRD[Point-based grading]
  end
  Mongo[(MongoDB<br/>users, quizzes, answers,<br/>PDFs in GridFS)]
  PG[(Postgres + pgvector<br/>chunks, embeddings, FTS)]
  Gemini[[Gemini API<br/>embeddings + LLM]]

  UI -- "JWT" --> API
  API --> Mongo
  API -- "upload" --> IDX -- "X-Service-Token" --> ING
  API -- "selected text + pages" --> GEN
  GR --> GRD
  ING --> PG
  RET --> PG
  GEN --> RET
  ING -. embed .-> Gemini
  RET -. embed query .-> Gemini
  GEN -. JSON schema .-> Gemini
  GRD -. JSON schema .-> Gemini
```

1. **Upload**: the PDF goes to Vercel Blob in production (the browser uploads it directly, with a
   short-lived token from the API) or GridFS locally; the backend indexes it in the background, and in
   production the RAG service downloads it itself through a 10-minute signed URL. The RAG service
   extracts text per page (keeping physical page numbers and printed labels like `xii` or `44`),
   chunks it into exact character spans so every chunk knows its page range, embeds the chunks
   (`gemini-embedding-001`, 768-d, normalised) and stores them in pgvector.
2. **Generate**: the viewer sends the selected text and the pages it spans. The service retrieves the
   matching chunks and asks Gemini, in JSON mode with a schema, for questions with a reference answer,
   2–5 key points and the ids of the sources used. Citations are verified in code: a question that cites
   a chunk it wasn't given is dropped.
3. **Grade**: for each key point Gemini judges *covered / partial / missing*; the score and verdict are
   computed from those judgements in code. Feedback cites pages, and "Review: p. 44" jumps the viewer there.

## Design decisions

- **pgvector, not a separate vector DB.** User/document/page filters and the vector search are one SQL
  query; deleting a document deletes its chunks in the same transaction; full-text search sits next to
  the vectors for hybrid retrieval; and the service holds no state of its own, so it can run as a
  serverless function. Cost: a second database beside Mongo, with a clean boundary (app data vs. index).
- **Page-level eval labels.** Retrieval labels are page numbers, not chunk ids, so one label set compares
  chunk sizes, embedding models and retrieval modes.
- **Decomposed grading.** Narrow per-point decisions are more consistent and explainable than a
  holistic 0–100 number; the eval measures it against a human (κ 0.84 weighted vs 0.54 for the old grader).
- **Nothing tuned on the test sets.** Labels and hand grades were committed before each first run; a
  tempting threshold tweak was checked post hoc and rejected (no net gain).
- **Built for flaky upstreams.** Embeddings are paced to the free tier's 100/min; LLM calls retry with the
  server's `RetryInfo` delay and fall back to a second model when the first stays overloaded.
- **Security boundary.** End users never reach the RAG service: the backend authenticates them (JWT) and
  calls the service with a shared token and the verified user id; every query filters on that user.

## Deployment

Everything runs serverless, so there is no 50-second cold start like the old Render free tier.

| Part | Where | Notes |
|---|---|---|
| React app | Vercel (`sams-frontend`) | static build, SPA rewrite |
| Express API | Vercel function (`sams-api`, `backend/`, sin1) | `server.js` exports the app; indexing runs after the response via `waitUntil` |
| RAG service | Vercel Python function (`sams-rag`, `rag_service/`, sin1) | ~150 MB bundle, no torch: embeddings come from the API |
| PDFs | Vercel Blob (private) | uploads bypass the 4.5 MB function body limit |
| Vectors | Neon Postgres + pgvector (Singapore) | scales to zero, wakes in ~0.5 s, never paused for inactivity |
| App data | MongoDB Atlas | unchanged |

Why Neon over Supabase: the free Supabase project pauses after a week without traffic and has to be
restored by hand; Neon only suspends compute and resumes on the next query. Pushing to `main` redeploys
all three Vercel projects.

## Run it locally

Needs Docker and a [Gemini API key](https://aistudio.google.com/apikey).

```bash
cp .env.example .env          # set GOOGLE_API_KEY
docker compose up --build
```

- App: http://localhost:3000 (register, upload a PDF, open it, select text, *Generate*)
- API: http://localhost:8000/api/test
- RAG service docs: http://localhost:8001/docs

## Tests and evals

```bash
# RAG service: unit + API tests (DB tests need Postgres with pgvector)
docker compose -f compose.dev.yml up -d db
docker compose -f compose.dev.yml exec db createdb -U rag rag_test   # tests drop and recreate their tables
cd rag_service && pip install -r requirements-dev.txt
TEST_DATABASE_URL=postgresql://rag:rag@localhost:5433/rag_test pytest

# Backend
cd backend && npm ci && npm test

# Evals (real Gemini calls)
evals/corpus/fetch_corpus.sh
python evals/retrieval/run_retrieval_eval.py
python evals/grading/run_grader_eval.py
```

CI (`.github/workflows/ci.yml`) runs the Python tests against a pgvector service container, the backend
tests, a production frontend build, and builds every Docker image.

## Repository layout

```
frontend/       React app (PDF viewer with citations, practice, skill analysis, admin)
backend/        Express API: auth, quizzes, grading router, RAG client, background indexer
rag_service/    FastAPI: PDF ingestion, chunking, embeddings, pgvector store, grounded generation, grading
evals/          retrieval and grader-agreement evals, labels, results
docs/           screenshots
```

## Other features

Folders and file management, timetable, break reminders, subject → topic → subtopic → concept
analytics, Stripe premium plan, admin panel (users, notifications, settings).

## Configuration

See `backend/.env.example`, `rag_service/README.md` and `.env.example` (Docker). Question
generation and grading need the RAG service (`RAG_ENABLED=true`); without it those endpoints return 503.
Blob uploads switch on when `BLOB_READ_WRITE_TOKEN` is set; otherwise PDFs go to GridFS.
