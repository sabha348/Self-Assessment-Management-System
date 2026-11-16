"""Test doubles."""

import hashlib
import re

import numpy as np

from app.embeddings import l2_normalize


class KeywordEmbedder:
    """Deterministic bag-of-words embedder: texts sharing words get similar
    vectors. Good enough to test retrieval plumbing without a network."""

    def __init__(self, dim: int = 768):
        self.dim = dim
        self.name = f"keyword-fake@{dim}"
        self.document_calls = 0

    def _vec(self, text: str) -> np.ndarray:
        v = np.zeros(self.dim, dtype=np.float32)
        for word in re.findall(r"[a-z0-9]+", text.lower()):
            h = int(hashlib.md5(word.encode()).hexdigest(), 16)
            v[h % self.dim] += 1.0
        if not v.any():
            v[0] = 1.0
        return v

    def embed_documents(self, texts):
        self.document_calls += 1
        return l2_normalize(np.stack([self._vec(t) for t in texts])) if texts else np.zeros((0, self.dim))

    def embed_query(self, text):
        return l2_normalize(self._vec(text)[None, :])[0]


class ScriptedLLM:
    """Returns pre-set outputs per schema name; records prompts."""

    name = "scripted"

    def __init__(self, outputs: dict):
        self.outputs = outputs  # schema class name -> dict or callable(prompt) -> dict
        self.prompts = []

    def generate_json(self, prompt, schema, temperature=0.2):
        self.prompts.append(prompt)
        out = self.outputs[schema.__name__]
        return schema.model_validate(out(prompt) if callable(out) else out)
