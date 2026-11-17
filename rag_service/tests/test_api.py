import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app, get_embedder, get_llm, get_store
from tests.fakes import KeywordEmbedder, ScriptedLLM
from tests.pdf_factory import make_pdf

pytestmark = pytest.mark.db
TOKEN = "test-token"
LLM_HOLDER = {"llm": ScriptedLLM({})}
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
        get_llm: lambda: LLM_HOLDER["llm"],
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
    bad = c.post("/v1/retrieve", headers=H, json={"query": "q", "user_id": "u1", "page_min": 3, "page_max": 1})
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


def gen_output(prompt):
    # Cite whichever source mentions "while loop" (the retrieval decides the numbering).
    sid = next(line.split("]")[0][1:] for line in prompt.splitlines() if line.startswith("[S") and "while" in prompt)
    return {
        "insufficient_context": False,
        "questions": [
            {
                "question": "What makes a while loop stop?",
                "reference_answer": "When its condition becomes false.",
                "key_points": ["the condition becomes false"],
                "source_ids": [sid],
            },
            {"question": "Invented?", "reference_answer": "x", "key_points": ["x"], "source_ids": ["S42"]},
        ],
    }


def test_questions_are_grounded_and_cite_pages(client):
    c, _ = client
    upload(c)
    LLM_HOLDER["llm"] = ScriptedLLM({"_GenOutput": gen_output})
    r = c.post(
        "/v1/questions",
        headers=H,
        json={"user_id": "u1", "document_id": "doc1", "n": 3, "focus_text": "A while loop repeats its body"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert [q["question"] for q in body["questions"]] == ["What makes a while loop stop?"]
    assert body["dropped"] == 1
    [cit] = body["questions"][0]["citations"]
    assert cit["page_start"] == 3 and "while loop" in cit["snippet"]
    assert body["retrieved"]


def test_questions_require_an_indexed_document_owned_by_the_user(client):
    c, _ = client
    upload(c, user="owner")
    for user, doc in (("owner", "nope"), ("intruder", "doc1")):
        r = c.post("/v1/questions", headers=H, json={"user_id": user, "document_id": doc})
        assert r.status_code == 409


def test_grade_uses_the_users_own_chunks(client, store):
    c, _ = client
    upload(c)
    chunk = store.search_keyword(
        "while loop", __import__("app.store", fromlist=["SearchFilters"]).SearchFilters("u1"), 1
    )[0]
    LLM_HOLDER["llm"] = ScriptedLLM(
        {
            "_GradeOutput": {
                "points": [{"point": 1, "status": "covered", "reason": "ok"}],
                "contradicts_sources": False,
                "feedback": "Right.",
                "source_ids": ["S1"],
            }
        }
    )
    item = {
        "question": "Q?",
        "reference_answer": "ref",
        "key_points": ["the condition becomes false"],
        "source_chunk_ids": [chunk.chunk_id],
        "answer": "it stops when the condition is false",
    }
    r = c.post("/v1/grade", headers=H, json={"user_id": "u1", "items": [item, {**item, "answer": "idk"}]})
    assert r.status_code == 200, r.text
    a, b = r.json()["results"]
    assert (a["verdict"], a["score"], a["citations"][0]["page_start"]) == ("correct", 100, 3)
    assert (b["verdict"], b["score"]) == ("incorrect", 0)
    # Another user cannot grade against (and so read) these chunks.
    r = c.post("/v1/grade", headers=H, json={"user_id": "intruder", "items": [item]})
    assert r.status_code == 404


def test_llm_outage_returns_502(client):
    from app.llm import LLMError

    c, _ = client
    upload(c)

    class Down:
        name = "down"

        def generate_json(self, *a, **k):
            raise LLMError("LLM API error 503")

    LLM_HOLDER["llm"] = Down()
    r = c.post("/v1/questions", headers=H, json={"user_id": "u1", "document_id": "doc1"})
    assert r.status_code == 502 and "LLM provider unavailable" in r.json()["detail"]


def test_ingest_from_url_downloads_then_ingests(client, monkeypatch):
    import app.main as main

    c, _ = client
    seen = {}

    def fake_fetch(url, hosts, max_bytes):
        seen.update(url=url, hosts=hosts, max_bytes=max_bytes)
        return make_pdf(BOOK)

    monkeypatch.setattr(main, "fetch_pdf", fake_fetch)
    body = {
        "document_id": "u-doc",
        "user_id": "u1",
        "title": "Book",
        "source_url": "https://s.private.blob.vercel-storage.com/pdfs/u1/book.pdf",
    }
    r = c.post("/v1/documents/from-url", headers=H, json=body)
    assert r.status_code == 200, r.text
    assert r.json()["pages"] == 4
    assert seen["hosts"] == ["blob.vercel-storage.com"] and seen["max_bytes"] == 1024 * 1024
    assert c.post("/v1/documents/from-url", json=body).status_code == 401


def test_ingest_from_url_rejects_other_hosts(client):
    c, _ = client
    body = {"document_id": "d", "user_id": "u1", "source_url": "https://169.254.169.254/latest/meta-data"}
    r = c.post("/v1/documents/from-url", headers=H, json=body)
    assert r.status_code == 422 and "not allowed" in r.json()["detail"]


def test_grade_without_sources_uses_the_reference(client):
    c, _ = client
    LLM_HOLDER["llm"] = ScriptedLLM(
        {
            "_GradeOutput": {
                "points": [{"point": 1, "status": "partial", "reason": "r"}],
                "contradicts_sources": False,
                "feedback": "Close.",
                "source_ids": [],
            }
        }
    )
    item = {"question": "Q?", "reference_answer": "Strings are immutable.", "answer": "you cannot change them"}
    r = c.post("/v1/grade", headers=H, json={"user_id": "u1", "items": [item]})
    assert r.status_code == 200, r.text
    [res] = r.json()["results"]
    assert (res["verdict"], res["score"], res["citations"]) == ("partial", 50, [])
    assert "no source passages" in LLM_HOLDER["llm"].prompts[-1]
