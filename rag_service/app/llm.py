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
        timeout_s: float = 45.0,
        max_wait_s: float = 10.0,
        client=None,
        sleep: Callable[[float], None] = time.sleep,
    ):
        if client is None:
            from google import genai

            if not api_key:
                raise ValueError("GOOGLE_API_KEY is required for the LLM")
            # Per-request timeout (ms): a hung or very slow call must not hold a
            # student's request for minutes; it fails over to the fallback model.
            # Gemini also enforces it as a server deadline, which must be >= 10 s.
            # SDK-internal retries are switched off (attempts=1): this class owns retry, the
            # server's RetryInfo delay and model fallback, and two stacked retry loops made
            # one slow call take minutes.
            client = genai.Client(
                api_key=api_key,
                http_options={"timeout": int(max(timeout_s, 10.0) * 1000), "retry_options": {"attempts": 1}},
            )
        self._client = client
        self.model = model
        self.name = model
        self.thinking_level = thinking_level
        self.max_retries = max_retries
        self.fallback_model = fallback_model
        self.max_wait_s = max_wait_s  # longest back-off worth waiting on one model
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
                if delay is not None and delay > self.max_wait_s:
                    # e.g. a quota that resets in a minute: a student shouldn't wait for it,
                    # and the fallback model has its own quota.
                    log.warning("LLM %s returned %s asking to wait %.0fs; not waiting", model, e.code, delay)
                    raise _Exhausted(e.code) from e
                wait = min(delay + 1 if delay is not None else 2**attempt, self.max_wait_s)
                log.warning("LLM %s returned %s, retry %d in %.0fs", model, e.code, attempt + 1, wait)
                self._sleep(wait)
            except Exception as e:  # network / TLS / timeout
                if "timeout" in type(e).__name__.lower():
                    log.warning("LLM %s timed out after %.0fs", model, time.monotonic() - started)
                    raise _Exhausted(504) from e  # slow: don't wait again on the same model
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
        api_key=settings.google_api_key,
        model=settings.llm_model,
        fallback_model=settings.llm_fallback_model or None,
        timeout_s=settings.llm_timeout_s,
    )
