"""Embedding models behind a small interface, so the store and the eval can
swap models (e.g. compare Gemini against a local model) without changes."""

import re
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
_RETRY_DELAY = re.compile(r"^(\d+(?:\.\d+)?)s$")


def server_retry_delay(error) -> float | None:
    """The delay a 429 response asks for (google.rpc.RetryInfo), in seconds."""
    details = (getattr(error, "details", None) or {}).get("error", {}).get("details", [])
    for d in details:
        if str(d.get("@type", "")).endswith("RetryInfo"):
            m = _RETRY_DELAY.match(str(d.get("retryDelay", "")))
            if m:
                return float(m.group(1))
    return None


class RateLimiter:
    """Sliding-window limit on items per minute. Gemini's free tier counts
    every text in a batch against its per-minute quota, so batching alone
    does not avoid 429s; pacing the items does."""

    def __init__(self, per_minute: int, clock=time.monotonic, sleep=time.sleep):
        self.per_minute, self._clock, self._sleep = per_minute, clock, sleep
        self._sent: list[tuple[float, int]] = []  # (timestamp, n_items)

    def acquire(self, n: int) -> None:
        if self.per_minute <= 0:
            return
        n = min(n, self.per_minute)
        while True:
            now = self._clock()
            self._sent = [(t, k) for t, k in self._sent if now - t < 60]
            used = sum(k for _, k in self._sent)
            if used + n <= self.per_minute:
                self._sent.append((now, n))
                return
            # Wait until enough of the oldest items leave the window.
            freed, wait = 0, 0.0
            for t, k in self._sent:
                freed += k
                wait = 60 - (now - t)
                if used - freed + n <= self.per_minute:
                    break
            self._sleep(max(wait, 0.05))


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
        max_retries: int = 6,
        max_per_minute: int = 0,
        client=None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ):
        if client is None:
            from google import genai

            if not api_key:
                raise ValueError("GOOGLE_API_KEY is required for Gemini embeddings")
            # Our own retry/backoff/rate limiting only; no SDK-internal retries stacked on top.
            client = genai.Client(api_key=api_key, http_options={"timeout": 60_000, "retry_options": {"attempts": 1}})
        self._client = client
        self.model = model
        self.dim = dim
        self.batch_size = batch_size
        self.max_retries = max_retries
        self._sleep = sleep
        # 0 disables pacing. For the free tier use ~90 (limit is 100/min).
        self._limiter = RateLimiter(max_per_minute, clock=clock, sleep=sleep)
        self.name = f"{model}@{dim}"

    def _embed(self, texts: Sequence[str], task_type: str) -> np.ndarray:
        from google.genai import errors, types

        config = types.EmbedContentConfig(task_type=task_type, output_dimensionality=self.dim)
        out: list[list[float]] = []
        step = self.batch_size
        if self._limiter.per_minute > 0:
            step = min(step, self._limiter.per_minute)
        for start in range(0, len(texts), step):
            batch = list(texts[start : start + step])
            for attempt in range(self.max_retries + 1):
                self._limiter.acquire(len(batch))
                try:
                    resp = self._client.models.embed_content(model=self.model, contents=batch, config=config)
                    break
                except errors.APIError as e:
                    if e.code not in RETRYABLE or attempt == self.max_retries:
                        raise EmbeddingError(f"embedding API error {e.code}") from e
                    # Prefer the delay the server asks for; else exponential backoff.
                    delay = server_retry_delay(e)
                    self._sleep(min(delay + 1 if delay is not None else 2**attempt, 65))
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
        max_per_minute=settings.embedding_max_per_minute,
    )
