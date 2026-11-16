import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app, get_embedder, get_store
from tests.fakes import KeywordEmbedder
from tests.pdf_factory import make_pdf

pytestmark = pytest.mark.db
TOKEN = "test-token"
H = {"X-Service-Token": TOKEN}

BOOK = [
    "Chapter 1. Variables. An assignment statement creates a new variable and gives it a value.",
    "Chapter 2. Functions. A function is a named sequence of statements that performs a computation.",
    "Chapter 3. Iteration. A while loop repeats its body until the condition becomes false.",
    "Chapter 4. Recursion. A recursive function calls itself and needs a base case to stop.",
]


@pytest.fixture
def client(store):
    emb = KeywordEmbedder()
    settings = Settings(service_token=TOKEN, chunk_size=100, chunk_overlap=0, max_upload_mb=1)
    app.dependency_overrides = {
        get_settings: lambda: settings,
        get_store: lambda: store,
        get_embedder: lambda: emb,
    }
    # No `with`: the lifespan (real DB pool + Gemini client) is not started.
    yield TestClient(app), emb
    app.dependency_overrides = {}


def upload(c, doc_id="doc1", user="u1", pages=BOOK, headers=H):
    return c.post(
        "/v1/documents",
        headers=headers,
        data={"document_id": doc_id, "user_id": user, "title": "Book"},
        files={"file": ("book.pdf", make_pdf(pages), "application/pdf")},
    )


def test_requires_service_token(client):
    c, _ = client
    assert upload(c, headers={}).status_code == 401
    assert upload(c, headers={"X-Service-Token": "wrong"}).status_code == 401
    assert c.post("/v1/retrieve", json={"query": "x", "user_id": "u"}).status_code == 401


def test_ingest_then_retrieve_cites_the_right_page(client):
    c, _ = client
    r = upload(c)
    assert r.status_code == 200, r.text
    assert r.json() == {"document_id": "doc1", "pages": 4, "chunks": 4, "skipped": False}

    for mode in ("dense", "keyword", "hybrid"):
        r = c.post(
            "/v1/retrieve",
            headers=H,
            json={"query": "how does a while loop repeat", "user_id": "u1", "k": 2, "mode": mode},
        )
        assert r.status_code == 200, r.text
        top = r.json()["chunks"][0]
        assert (top["page_start"], top["page_end"]) == (3, 3), mode
        assert "while loop" in top["text"]


def test_reingesting_identical_pdf_is_skipped(client):
    c, emb = client
    upload(c)
    calls = emb.document_calls
    r = upload(c)
    assert r.json()["skipped"] is True
    assert emb.document_calls == calls  # no new embedding calls


def test_changed_pdf_is_reingested(client):
    c, _ = client
    upload(c)
    r = upload(c, pages=BOOK[:2])
    assert r.json() == {"document_id": "doc1", "pages": 2, "chunks": 2, "skipped": False}


def test_cannot_overwrite_or_delete_another_users_document(client):
    c, _ = client
    upload(c, user="owner")
    assert upload(c, user="intruder").status_code == 403
    assert c.delete("/v1/documents/doc1", params={"user_id": "intruder"}, headers=H).status_code == 404
    assert c.delete("/v1/documents/doc1", params={"user_id": "owner"}, headers=H).status_code == 204
    assert c.delete("/v1/documents/doc1", params={"user_id": "owner"}, headers=H).status_code == 404


def test_rejects_bad_uploads(client):
    c, _ = client
    r = c.post(
        "/v1/documents",
        headers=H,
        data={"document_id": "d", "user_id": "u"},
        files={"file": ("x.pdf", b"not a pdf", "application/pdf")},
    )
    assert r.status_code == 422
    big = b"%PDF" + b"0" * (1024 * 1024 + 10)
    r = c.post(
        "/v1/documents",
        headers=H,
        data={"document_id": "d", "user_id": "u"},
        files={"file": ("x.pdf", big, "application/pdf")},
    )
    assert r.status_code == 413


def test_retrieve_validates_input_and_caps_k(client):
    c, _ = client
    upload(c)
    bad = c.post("/v1/retrieve", headers=H, json={"query": "", "user_id": "u1"})
    assert bad.status_code == 422
    bad = c.post(
        "/v1/retrieve", headers=H, json={"query": "q", "user_id": "u1", "page_min": 3, "page_max": 1}
    )
    assert bad.status_code == 422
    r = c.post("/v1/retrieve", headers=H, json={"query": "function", "user_id": "u1", "k": 999})
    assert r.status_code == 200 and len(r.json()["chunks"]) <= 4


def test_page_filter(client):
    c, _ = client
    upload(c)
    r = c.post(
        "/v1/retrieve",
        headers=H,
        json={"query": "function", "user_id": "u1", "page_min": 4, "page_max": 4, "k": 5},
    )
    assert [ch["page_start"] for ch in r.json()["chunks"]] == [4]


def test_embedding_outage_returns_502(client, monkeypatch):
    from app.embeddings import EmbeddingError

    c, emb = client

    def down(_):
        raise EmbeddingError("embedding request failed: ConnectError")

    monkeypatch.setattr(emb, "embed_query", down)
    r = c.post("/v1/retrieve", headers=H, json={"query": "q", "user_id": "u1"})
    assert r.status_code == 502
    assert "embedding provider unavailable" in r.json()["detail"]
