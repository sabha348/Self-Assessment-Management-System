# SmartAssess upgrade plan: grounded RAG + evals

Status: **draft, waiting for approval**. No code has been changed.

---

## 1. Current state (what the code does today)

### Structure

```
backend/                     Express API (Node, CommonJS), entry server.js, Procfile for Render
  authentication/            login.js, register.js (bcrypt + JWT)
  routes/                    quizRouter (generate + grade), assessmentRouter (practice by hierarchy),
                             userAnalyticsRouter (2.5k lines), payment (Stripe), admin, files, folders, ...
  controllers/               assessmentController (practice submit + grading), adminController, ...
  models/                    Mongoose: User, Document, Quiz, Question, UserAnswer, AssessmentResult, ...
  services/fileService.js    PDF upload into MongoDB GridFS (bucket pdfFiles)
  utils/pythonRunner.js      spawns `python <script> <args>` per request, decodes base64 stdout
  utils/TextCategory.js      Gemini REST call from Node: subject/topic/subtopic/concept
  python_scripts/            assessment_system.py (Gemini wrapper + grader), questions.py,
                             correct_answers.py, evaluate_answers.py
frontend/                    CRA React 18, Redux, MUI + Tailwind, pdf.js viewer, deployed on Vercel
```

### How PDFs are processed now

1. The user uploads a PDF. `fileService.uploadFile` streams the raw bytes into GridFS. **The server never parses the PDF**, so there is no text, no chunks and no page numbers on the server.
2. In `PdfViewer.jsx` the user selects text in the pdf.js viewer, or every 5 minutes the visible text is collected automatically. The browser sends that raw string to `POST /api/quizzes`.
3. `quizRouter` saves a `Quiz` with `content = text.substring(0, 1000)`, spawns `questions.py` with the text as a command-line argument, and returns the questions.
4. After the response has been sent, it does more work in the background: it categorises the text with Gemini (`TextCategory.js`), spawns `correct_answers.py` to make reference answers, and saves the `Question` rows.

Grounding today is weak. The question prompt asks for "standalone" questions. The answer prompt says *"if the context is insufficient, use general knowledge"*. Nothing links a question or an answer back to a page.

### How grading works now

`evaluate_answers.py` → `AssessmentSystem.evaluate_answer(user, reference)`:

1. Gemini gets the reference answer and the user's answer and is asked for free text in the form `Accuracy:XX, Missing Points:[...], Analysis:...`. A regex pulls out the first number after "Accuracy" and the missing points.
2. A "custom similarity" score is also computed: `difflib.SequenceMatcher` character ratio × 0.6 + keyword overlap × 0.4 + 10 bonus points ("lenient" mode).
3. `final = gemini_accuracy if parsed else custom_score`; `is_correct = final >= 60`.

Interview-relevant facts:
- The "semantic similarity" is really a character-sequence ratio. It is only a fallback, used when the regex fails.
- There is no rubric, no structured output, no use of the source text, and no record of which path produced the score.
- Each Python process calls Gemini once with `"Test connection"` before doing any work, so every request costs one extra API call.
- When reference answers are generated on demand at submit time, they come from `quiz.content`, which holds only the first 1,000 characters.
- `--difficulty` and `--type` are passed to `questions.py`, but the script ignores them.
- The SDK (`google-generativeai`) and the model (`gemini-2.0-flash-lite`) are both deprecated.

## 2. Blockers and risks found

| # | Blocker | Severity | Fix |
|---|---|---|---|
| B1 | `backend/.env` and `frontend/.env` are tracked in git, even though `.gitignore` lists `.env`. They contain a live Gemini key, a MongoDB URI with username and password, a Stripe test secret key and a Gmail app password. The repo is public on GitHub. | **Critical** | **You must rotate all four** (only you can, with your accounts). I will untrack the files and add `.env.example`. Removing them from history needs a force-push to `main`, which I will only do if you say so. Rotating the keys is the actual fix. |
| B2 | `JWT_SECRET` is a placeholder-style value, so tokens could be forged if it is guessed. | High | Generate a strong secret and set it on the host. |
| B3 | `login.js` logs the plaintext password and the hash on every login. | High | Remove the logs. |
| B4 | `/api/quizzes` (generate, submit, results) has **no auth middleware** and trusts `userId` from the request body, so anyone can act as any user. | High | Add `authenticateToken` and use `req.user.userId`. |
| B5 | `scripts/resetPassword.js` hard-codes an admin email and password. `adminController.resetUserPassword` uses `req.user._id`, which the token does not carry, and sets `passwordResetRequired`, which is not in the schema. | Medium | Parameterise the script; fix the field names. |
| B6 | Python is reached with `child_process.spawn('python', [script, hugeText])`: one process per request, the PDF text passed as a command-line argument (size limits apply), output passed back as base64 on stdout. `spawn('python')` fails on hosts that only have `python3`. This cannot run on Vercel. | High (architecture) | Replace it with an HTTP FastAPI service (M1/M2). |
| B7 | Work continues after `res.json()` (categorising, answer generation, saving questions). If you submit before it finishes, you get "Questions not found". On serverless hosts this background work is killed outright. | Medium | Make it explicit: run it synchronously, or use `waitUntil` on Vercel. |
| B8 | **No tests.** The only test is the default CRA `App.test.js`, and there is no CI. The README mentions `npm test`, docker-compose and `/api/docs`, and none of them exist. | Medium | Add pytest for the RAG service and CI in M3. See question Q3. |
| B9 | `requirements.txt` is UTF-16 encoded and lists packages that are never used (spaCy, NLTK, scikit-learn, numpy). | Low | Write a new requirements file for the new service. |
| B10 | `__pycache__/*.pyc` and `assessment_debug.log` are committed. | Low | Remove them and add them to `.gitignore`. |
| B11 | `scripts/membershipChecker.js` (node-cron) is never imported, so expired memberships are never downgraded. It also writes `"Free"`, but the schema's enum value is `'free'`. | Low | Fix it, and use a Vercel Cron job if you move to Vercel. |
| B12 | There is no forgot-password flow. Only an admin "reset" exists, and it returns the temporary password in the API response. | Medium (you're locked out) | Add an emailed, single-use, time-limited reset token (M0). |

## 3. Key design decisions

### Vector store: **pgvector** (recommended over Chroma)

| | pgvector (Postgres) | Chroma |
|---|---|---|
| Serverless and Vercel | Works. Use a hosted Postgres (Supabase or Neon free tier); the service holds no state. | Needs a long-running server with a persistent disk. That puts us back on Render-style cold starts. |
| Metadata filtering | Plain SQL `WHERE user_id = $1 AND document_id = $2` combined with the vector `ORDER BY`. | Has metadata filters, but they are less expressive. |
| Delete when a PDF is deleted | `DELETE ... WHERE document_id` in a transaction. | Possible, but there's no transactional guarantee. |
| Hybrid search later | Postgres full-text search (`tsvector`) sits next to the vectors, so BM25-style plus dense is one query. | Needs a separate keyword index. |
| Local dev and Docker | `pgvector/pgvector:pg16` image, one service. | `chromadb/chroma` image, one service. |
| Cost | A second database next to Mongo. | Also a second store. |

The repo already uses Mongo, so **MongoDB Atlas Vector Search** would avoid adding a database. I'm leaving it out because local Docker parity is clumsy (it needs the `atlas-local` image) and it is less transferable as an interview talking point. Mongo stays the store for app data. Postgres holds only `documents`/`chunks`/`embeddings`, keyed by the Mongo `Document._id`.

### Embeddings: Gemini `gemini-embedding-001` (768 dimensions) behind an `Embedder` interface

- An API model keeps the service small. A local model like sentence-transformers pulls in torch (over 1 GB), which is too big for a Vercel function (250 MB limit).
- `task_type=RETRIEVAL_DOCUMENT` for chunks and `RETRIEVAL_QUERY` for queries: the asymmetric embeddings Gemini supports.
- The interface allows a local `bge-small` embedder in Docker-only mode, so the recall@5 eval can compare the two. That makes a good interview story.

### Chunking that keeps page numbers

- Extract text per page with `pypdf` (permissive licence; PyMuPDF is AGPL).
- Join the pages into one text and keep an offset → page map. Split into windows of about 800 tokens with about 120 tokens of overlap, on paragraph or sentence boundaries. Each chunk stores `page_start`, `page_end`, `char_start` and `char_end`, so a chunk that crosses a page break still cites both pages.
- Each chunk's id is a content hash, so re-ingesting a document is idempotent.

### Grounded generation contract

- Node → RAG `POST /questions` `{document_id, focus_text?, pages?, n, difficulty}`. The service retrieves the top-k chunks, filtered by user and document. Gemini runs in **JSON mode with a response schema**. Each question must return `source_chunk_ids` and a `reference_answer` with `citations`.
- **Citation validation in code:** any question that cites a chunk id that wasn't retrieved is dropped, not passed through. If retrieval returns nothing useful, the service returns an "insufficient context" error instead of falling back to general knowledge.
- Grading `POST /grade` `{question_id, answer}` re-uses the question's stored source chunks. It grades against a rubric (key points taken from the reference answer) and returns structured output: `{score 0-100, verdict: correct|partial|incorrect, missing_points[], feedback, citations[]}`. The difflib score is kept **only** as a logged baseline for the eval, not as a silent fallback.
- All Gemini calls move into the Python service (`google-genai` SDK). Node becomes an orchestrator with a single `ragClient`.

### Eval design

- **recall@5**: you label each question with **gold pages**, not gold chunks. Labels then stay valid when the chunking changes, and I can re-run the eval for each chunking or embedding variant. A hit means any of the top-5 retrieved chunks overlaps a gold page. I'll also report MRR.
- **Grader agreement**: on 30 answers you grade by hand (verdict, plus an optional 0-100 score), I'll report:
  - exact agreement %
  - Cohen's κ, unweighted and quadratic-weighted, since verdicts are ordinal
  - a confusion matrix
  - Spearman correlation of the scores, if you give scores
  - a disagreement table broken down by question type, answer length and over- vs under-grading, with each disagreeing item listed

  The old grader (Gemini plus regex, with difflib as fallback) is run on the same 30 answers as a baseline.
- Label files live in `evals/data/`. I only write **empty templates and the schema**; you write every label.

## 4. Milestones (one PR per milestone)

Every commit is small and leaves the app working. A feature flag, `RAG_ENABLED`, keeps the old path until M2 is verified.

### M0: Safety and account recovery (small PR, first)
1. `chore: untrack .env files, add .env.example for backend and frontend, ignore pycache and logs`
2. `fix(auth): stop logging passwords; require auth on /api/quizzes and use req.user.userId`
3. `fix(scripts): resetPassword takes --email from argv and reads the password from a prompt, nothing hard-coded`
4. `feat(auth): forgot-password, with a hashed single-use token, 30-min expiry and an email via the existing nodemailer config`
5. `feat(ui): "Forgot password?" link plus ForgotPassword and ResetPassword pages`

### M1: RAG service (FastAPI + pgvector) and the retrieval eval
1. `feat(rag): scaffold rag_service (FastAPI, pydantic-settings, /health, Dockerfile)`
2. `feat(rag): page-aware PDF text extraction (pypdf)`
3. `feat(rag): chunker with page_start/page_end and overlap`
4. `feat(rag): Embedder interface + Gemini embedder (batched, retry/backoff)`
5. `feat(rag): pgvector schema (SQL migration) + ChunkStore repository (HNSW cosine index)`
6. `feat(rag): POST /ingest (multipart PDF + document_id, user_id), idempotent re-ingest; DELETE /documents/{id}`
7. `feat(rag): POST /retrieve top-k with user/document/page filters`
8. `feat(rag): service-to-service auth via shared secret header`
9. `chore: docker-compose.dev.yml with postgres(pgvector) + rag_service`
10. `feat(evals): retrieval eval harness (recall@k, MRR, per-question report) + empty label template`

→ **Stop: you write `evals/data/retrieval_labels.jsonl`.** Then I run it, record the results and open the M1 PR.

### M2: Grounded generation and the Node/UI integration
1. `feat(rag): POST /questions, JSON-schema Gemini output with source chunk ids, citation validation`
2. `feat(rag): reference answers with citations, stored alongside each question`
3. `feat(rag): POST /grade, rubric-based structured grading grounded in the source chunks`
4. `feat(backend): ragClient (axios, timeout, retry, shared secret) + RAG_ENABLED flag`
5. `feat(backend): ingest on upload; delete on file delete; backfill script for existing GridFS PDFs`
6. `feat(models): Question gets documentId, sourceChunkIds, citations[{page, snippet}]`
7. `refactor(quiz): generate synchronously via RAG (removes the race after res.json)`
8. `refactor(grading): quizRouter + assessmentController submit via /grade`
9. `feat(ui): PdfViewer sends documentId + current page/selection; citation chips ("p. 12") jump to that page`
10. `feat(ui): results view shows feedback with page citations`
11. ~~`chore: remove python_scripts/ and pythonRunner (old path)`~~ **Moved to M4.** Production doesn't run the RAG service until M4, so the old path stays as the fallback (`RAG_ENABLED=false`, and also used while a PDF is still indexing). It's removed once the service is live.

→ **Stop: open the M2 PR.**

### M3: Grader eval, Docker, README
1. `feat(evals): export script, which dumps real answers from the DB into a CSV labelling sheet for you to hand-grade`
2. `feat(evals): grader agreement harness (agreement, κ, weighted κ, confusion matrix, disagreement report) with the old-grader baseline`

   → **Stop: you hand-grade 30 answers.** Then I run the harness.
3. `chore: Dockerfiles for backend and frontend (nginx); docker-compose.yml for mongo, postgres, rag, backend, frontend`
4. `ci: GitHub Actions running pytest + lint for rag_service and the backend lint`
5. `docs: README with a Mermaid architecture diagram, local setup, design decisions, and the eval results tables from the real runs`

→ **Stop: open the M3 PR.**

### M4 (optional): Move everything to Vercel. Needs your accounts.

**Can the whole stack run on Vercel? Yes, once M2 is done.**

| Part | On Vercel | What has to change |
|---|---|---|
| React frontend | Already there (`sams-frontend`) | Nothing |
| Express API | Vercel Node function (`api/index.js` exports `app`) | Cache the mongoose connection; request bodies are capped at **4.5 MB**, so PDF uploads go through Vercel Blob client uploads, and the function reads the PDF from Blob; post-response work uses `waitUntil` (from M2 there is none); node-cron becomes a Vercel Cron job |
| Python | **Not possible as it is today** (spawning a `python` subprocess from a Node function doesn't work) | The M1 FastAPI service deploys as a Vercel Python function, because embeddings come from an API (no torch) |
| Vector store | Not on Vercel itself | Supabase or Neon Postgres with pgvector (free tiers, no sleeping) |
| MongoDB | Atlas, unchanged | Atlas network access has to allow Vercel's dynamic IPs |

Cold starts become roughly 1 s instead of the ~50 s spin-up you get on Render's free tier. Doing this needs your Vercel and Supabase/Neon accounts and the rotated secrets, so it is a stop point.

## 5. Where I will stop and wait
- Eval labels and test data: retrieval labels (M1), 30 hand grades (M3).
- Anything that needs your accounts: rotating keys, Supabase/Neon, Vercel env vars, Render, the GitHub history purge.
- The end of each milestone, with a PR and an interview-ready summary of its design decisions.
