import os

import psycopg
import pytest

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


def _reset_schema(url: str) -> None:
    with psycopg.connect(url, autocommit=True) as conn:
        conn.execute("DROP TABLE IF EXISTS chunks, documents, schema_migrations CASCADE")


@pytest.fixture
def database_url():
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL not set (needs Postgres with pgvector)")
    _reset_schema(TEST_DATABASE_URL)
    return TEST_DATABASE_URL


@pytest.fixture
def store(database_url):
    from app.db import make_pool, migrate
    from app.store import ChunkStore

    migrate(database_url)
    pool = make_pool(database_url, max_size=3)
    yield ChunkStore(pool)
    pool.close()
