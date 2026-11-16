"""Embedding models behind a small interface, so the store and the eval can
swap models (e.g. compare Gemini against a local model) without changes."""

import time
from collections.abc import Callable, Sequence
from typing import Protocol

import numpy as np


class Embedder(Protocol):
    name: str  # stored with each document so stale embeddings can be detected
    dim: int

    def embed_documents(self, texts: Sequence[str]) -> np.ndarray: ...

    def embed_query(self, text: str) -> np.ndarray: ...


def l2_normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vectors / norms


class EmbeddingError(RuntimeError):
    """The embedding provider failed (network, auth, quota, bad response)."""


# Status codes worth retrying: rate limited, or a transient server error.
RETRYABLE = {429, 500, 502, 503, 504}


class GeminiEmbedder:
    """Gemini embeddings with asymmetric task types.

    Documents are embedded as RETRIEVAL_DOCUMENT and queries as
    RETRIEVAL_QUERY, which the model is trained to match against each other.
    Reduced-dimension (Matryoshka) outputs are not unit length, so vectors
    are L2-normalised before they are stored; cosine distance then behaves.
    """

    def __init__(
        self,
        api_key: str = "",
        model: str = "gemini-embedding-001",
        dim: int = 768,
        batch_size: int = 64,
        max_retries: int = 5,
        client=None,
        sleep: Callable[[float], None] = time.sleep,
    ):
        if client is None:
            from google import genai

            if not api_key:
                raise ValueError("GOOGLE_API_KEY is required for Gemini embeddings")
            client = genai.Client(api_key=api_key)
        self._client = client
        self.model = model
        self.dim = dim
        self.batch_size = batch_size
        self.max_retries = max_retries
        self._sleep = sleep
        self.name = f"{model}@{dim}"

    def _embed(self, texts: Sequence[str], task_type: str) -> np.ndarray:
        from google.genai import errors, types

        config = types.EmbedContentConfig(task_type=task_type, output_dimensionality=self.dim)
        out: list[list[float]] = []
        for start in range(0, len(texts), self.batch_size):
            batch = list(texts[start : start + self.batch_size])
            for attempt in range(self.max_retries + 1):
                try:
                    resp = self._client.models.embed_content(model=self.model, contents=batch, config=config)
                    break
                except errors.APIError as e:
                    if e.code not in RETRYABLE or attempt == self.max_retries:
                        raise EmbeddingError(f"embedding API error {e.code}") from e
                    self._sleep(min(2**attempt, 30))  # exponential backoff, capped
                except Exception as e:  # network / TLS / unexpected client failure
                    raise EmbeddingError(f"embedding request failed: {type(e).__name__}") from e
            vectors = [e.values for e in resp.embeddings]
            if len(vectors) != len(batch):
                raise EmbeddingError(f"expected {len(batch)} embeddings, got {len(vectors)}")
            out.extend(vectors)
        arr = np.asarray(out, dtype=np.float32).reshape(len(out), -1) if out else np.zeros((0, self.dim))
        if arr.shape[1] != self.dim:
            raise EmbeddingError(f"model returned dim {arr.shape[1]}, expected {self.dim}")
        return l2_normalize(arr)

    def embed_documents(self, texts: Sequence[str]) -> np.ndarray:
        return self._embed(texts, "RETRIEVAL_DOCUMENT")

    def embed_query(self, text: str) -> np.ndarray:
        return self._embed([text], "RETRIEVAL_QUERY")[0]


def build_embedder(settings) -> Embedder:
    return GeminiEmbedder(
        api_key=settings.google_api_key,
        model=settings.embedding_model,
        dim=settings.embedding_dim,
        batch_size=settings.embedding_batch_size,
    )
