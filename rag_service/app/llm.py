"""Structured-output LLM calls (Gemini), behind a small interface."""

import logging
import time
from collections.abc import Callable
from typing import Protocol, TypeVar

from pydantic import BaseModel

from .embeddings import RETRYABLE, server_retry_delay

T = TypeVar("T", bound=BaseModel)
log = logging.getLogger("rag.llm")


class LLMError(RuntimeError):
    """The LLM provider failed or returned something unusable."""


class LLM(Protocol):
    name: str

    def generate_json(self, prompt: str, schema: type[T], temperature: float = 0.2) -> T: ...


class GeminiLLM:
    """Gemini with JSON mode + a response schema, so output is parsed and
    validated by pydantic instead of scraped with regexes (the old grader
    regex-parsed 'Accuracy: NN' out of free text)."""

    def __init__(
        self,
        api_key: str = "",
        model: str = "gemini-3.5-flash-lite",
        thinking_level: str | None = "low",
        max_retries: int = 4,
        fallback_model: str | None = None,
        client=None,
        sleep: Callable[[float], None] = time.sleep,
    ):
        if client is None:
            from google import genai

            if not api_key:
                raise ValueError("GOOGLE_API_KEY is required for the LLM")
            client = genai.Client(api_key=api_key)
        self._client = client
        self.model = model
        self.name = model
        self.thinking_level = thinking_level
        self.max_retries = max_retries
        self.fallback_model = fallback_model
        self._sleep = sleep

    def _call(self, model: str, prompt: str, config, retries: int, schema_name: str):
        from google.genai import errors

        started = time.monotonic()
        for attempt in range(retries + 1):
            try:
                resp = self._client.models.generate_content(model=model, contents=prompt, config=config)
                elapsed = time.monotonic() - started
                log.info("LLM %s %s: %.1fs (attempts %d)", model, schema_name, elapsed, attempt + 1)
                return resp
            except errors.APIError as e:
                if e.code not in RETRYABLE or attempt == retries:
                    raise _Exhausted(e.code) if e.code in RETRYABLE else LLMError(f"LLM API error {e.code}") from e
                delay = server_retry_delay(e)
                wait = min(delay + 1 if delay is not None else 2**attempt, 65)
                log.warning("LLM %s returned %s, retry %d in %.0fs", model, e.code, attempt + 1, wait)
                self._sleep(wait)
            except Exception as e:  # network / TLS
                raise LLMError(f"LLM request failed: {type(e).__name__}") from e

    def generate_json(self, prompt: str, schema: type[T], temperature: float = 0.2) -> T:
        from google.genai import types

        base = dict(response_mime_type="application/json", response_schema=schema, temperature=temperature)
        primary = dict(base)
        if self.thinking_level:
            primary["thinking_config"] = types.ThinkingConfig(thinking_level=self.thinking_level)
        try:
            config = types.GenerateContentConfig(**primary)
            resp = self._call(self.model, prompt, config, self.max_retries, schema.__name__)
        except _Exhausted as e:
            # The primary model stayed overloaded (503/429) through every retry: try another
            # model once rather than failing the student's request. No thinking config, since
            # older fallback models use a different thinking setting.
            if not self.fallback_model:
                raise LLMError(f"LLM API error {e.code}") from e
            log.warning("LLM %s unavailable (%s); falling back to %s", self.model, e.code, self.fallback_model)
            try:
                resp = self._call(self.fallback_model, prompt, types.GenerateContentConfig(**base), 2, schema.__name__)
            except _Exhausted as e2:
                raise LLMError(f"LLM API error {e2.code} (primary and fallback)") from e2
        parsed = getattr(resp, "parsed", None)
        if isinstance(parsed, schema):
            return parsed
        try:
            return schema.model_validate_json(resp.text or "")
        except Exception as e:
            raise LLMError("LLM returned output that does not match the schema") from e


class _Exhausted(Exception):
    """Retries ran out on a retryable status (overload / rate limit)."""

    def __init__(self, code: int):
        super().__init__(code)
        self.code = code


def build_llm(settings) -> LLM:
    return GeminiLLM(
        api_key=settings.google_api_key, model=settings.llm_model, fallback_model=settings.llm_fallback_model or None
    )
