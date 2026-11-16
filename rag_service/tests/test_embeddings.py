from types import SimpleNamespace

import numpy as np
import pytest
from google.genai import errors

from app.embeddings import EmbeddingError, GeminiEmbedder, l2_normalize


class FakeModels:
    def __init__(self, dim=8, fail_first=0, code=429):
        self.dim, self.fail_first, self.code = dim, fail_first, code
        self.calls = []

    def embed_content(self, model, contents, config):
        self.calls.append((model, list(contents), config.task_type, config.output_dimensionality))
        if self.fail_first:
            self.fail_first -= 1
            raise errors.APIError(self.code, {"error": {"message": "x", "status": "x"}})
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
