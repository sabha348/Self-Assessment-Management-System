-- Vector store for the RAG service. Application data (users, quizzes, ...)
-- stays in MongoDB; documents.id is the Mongo Document._id.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents (
    id              text PRIMARY KEY,
    user_id         text        NOT NULL,
    title           text        NOT NULL DEFAULT '',
    sha256          text        NOT NULL,          -- of the PDF bytes, for idempotent re-ingest
    page_count      integer     NOT NULL,
    chunk_count     integer     NOT NULL,
    embedding_model text        NOT NULL,          -- e.g. gemini-embedding-001@768
    chunk_size      integer     NOT NULL,
    chunk_overlap   integer     NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documents_user_idx ON documents (user_id);

CREATE TABLE IF NOT EXISTS chunks (
    id               text PRIMARY KEY,             -- content hash: stable across re-ingests
    document_id      text    NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    user_id          text    NOT NULL,             -- denormalised so every search filters on it directly
    chunk_index      integer NOT NULL,
    page_start       integer NOT NULL,
    page_end         integer NOT NULL,
    page_label_start text    NOT NULL,
    page_label_end   text    NOT NULL,
    char_start       integer NOT NULL,
    char_end         integer NOT NULL,
    text             text    NOT NULL,
    embedding        vector(768) NOT NULL,
    tsv              tsvector GENERATED ALWAYS AS (to_tsvector('english', text)) STORED
);
CREATE INDEX IF NOT EXISTS chunks_document_idx ON chunks (document_id, chunk_index);
CREATE INDEX IF NOT EXISTS chunks_user_idx ON chunks (user_id);
-- Approximate nearest neighbour index for cosine distance (<=>).
CREATE INDEX IF NOT EXISTS chunks_embedding_hnsw ON chunks USING hnsw (embedding vector_cosine_ops);
-- Full-text index for keyword / hybrid retrieval.
CREATE INDEX IF NOT EXISTS chunks_tsv_idx ON chunks USING gin (tsv);
