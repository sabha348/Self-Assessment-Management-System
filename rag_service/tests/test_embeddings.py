from types import SimpleNamespace

import numpy as np
import pytest
from google.genai import errors

from app.embeddings import EmbeddingError, GeminiEmbedder, RateLimiter, l2_normalize, server_retry_delay


class FakeModels:
    def __init__(self, dim=8, fail_first=0, code=429, retry_delay=None):
        self.dim, self.fail_first, self.code = dim, fail_first, code
        details = [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": retry_delay}]
        self.body = {"error": {"message": "x", "status": "x", "details": details if retry_delay else []}}
        self.calls = []

    def embed_content(self, model, contents, config):
        self.calls.append((model, list(contents), config.task_type, config.output_dimensionality))
        if self.fail_first:
            self.fail_first -= 1
            raise errors.APIError(self.code, self.body)
        # Unnormalised vectors, like reduced-dimension Gemini output.
        return SimpleNamespace(
            embeddings=[SimpleNamespace(values=[float(len(t))] * self.dim) for t in contents]
        )


def make(models, **kw):
    return GeminiEmbedder(client=SimpleNamespace(models=models), dim=models.dim, sleep=lambda s: None, **kw)


def test_batches_and_preserves_order():
    models = FakeModels()
    emb = make(models, batch_size=2)
    out = emb.embed_documents(["a", "bb", "ccc", "dddd", "eeeee"])
    assert out.shape == (5, 8)
    assert [len(c[1]) for c in models.calls] == [2, 2, 1]
    assert [c[1] for c in models.calls] == [["a", "bb"], ["ccc", "dddd"], ["eeeee"]]


def test_vectors_are_unit_length():
    out = make(FakeModels()).embed_documents(["abc", "abcdef"])
    np.testing.assert_allclose(np.linalg.norm(out, axis=1), 1.0, rtol=1e-5)


def test_document_and_query_use_asymmetric_task_types():
    models = FakeModels()
    emb = make(models)
    emb.embed_documents(["doc"])
    q = emb.embed_query("question")
    assert q.shape == (8,)
    assert [c[2] for c in models.calls] == ["RETRIEVAL_DOCUMENT", "RETRIEVAL_QUERY"]
    assert all(c[3] == 8 for c in models.calls)


def test_retries_rate_limits_then_succeeds():
    models = FakeModels(fail_first=2, code=429)
    assert make(models).embed_documents(["x"]).shape == (1, 8)
    assert len(models.calls) == 3


def test_does_not_retry_client_errors():
    models = FakeModels(fail_first=1, code=400)
    with pytest.raises(EmbeddingError):
        make(models).embed_documents(["x"])
    assert len(models.calls) == 1


def test_gives_up_after_max_retries():
    models = FakeModels(fail_first=10, code=503)
    with pytest.raises(EmbeddingError):
        make(models, max_retries=2).embed_documents(["x"])
    assert len(models.calls) == 3


def test_name_encodes_model_and_dim():
    assert make(FakeModels()).name == "gemini-embedding-001@8"


def test_l2_normalize_handles_zero_vectors():
    out = l2_normalize(np.array([[0.0, 0.0], [3.0, 4.0]]))
    np.testing.assert_allclose(out, [[0, 0], [0.6, 0.8]])


def test_requires_api_key_without_client():
    with pytest.raises(ValueError):
        GeminiEmbedder(api_key="")


def test_network_errors_become_embedding_errors():
    class Boom:
        def embed_content(self, **kw):
            raise ConnectionError("tls failed")

    emb = GeminiEmbedder(client=SimpleNamespace(models=Boom()), dim=8, sleep=lambda s: None)
    with pytest.raises(EmbeddingError, match="ConnectionError"):
        emb.embed_query("x")


def test_uses_the_retry_delay_the_server_asks_for():
    models = FakeModels(fail_first=1, code=429, retry_delay="23s")
    slept = []
    emb = GeminiEmbedder(client=SimpleNamespace(models=models), dim=8, sleep=slept.append)
    emb.embed_query("x")
    assert slept == [24.0]  # 23s + 1s margin


def test_server_retry_delay_parsing():
    e = errors.APIError(429, {"error": {"details": [{"@type": "x.RetryInfo", "retryDelay": "1.5s"}]}})
    assert server_retry_delay(e) == 1.5
    assert server_retry_delay(errors.APIError(429, {"error": {}})) is None


class FakeClock:
    def __init__(self):
        self.t = 0.0

    def __call__(self):
        return self.t

    def sleep(self, s):
        self.t += s


def test_rate_limiter_paces_items_per_minute():
    clock = FakeClock()
    rl = RateLimiter(100, clock=clock, sleep=clock.sleep)
    rl.acquire(60)
    rl.acquire(40)
    assert clock.t == 0  # 100 items fit in the first minute
    rl.acquire(30)
    assert clock.t == pytest.approx(60)  # had to wait for the window to slide
    rl.acquire(0)
    assert RateLimiter(0).acquire(10_000) is None  # disabled


def test_embedder_splits_batches_to_fit_the_rate_limit():
    clock = FakeClock()
    models = FakeModels()
    emb = GeminiEmbedder(
        client=SimpleNamespace(models=models),
        dim=8,
        batch_size=64,
        max_per_minute=50,
        sleep=clock.sleep,
        clock=clock,
    )
    emb.embed_documents([str(i) for i in range(120)])
    assert [len(c[1]) for c in models.calls] == [50, 50, 20]
    assert clock.t == pytest.approx(120)  # two full windows waited
