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
        self._sleep = sleep

    def generate_json(self, prompt: str, schema: type[T], temperature: float = 0.2) -> T:
        from google.genai import errors, types

        kwargs = dict(response_mime_type="application/json", response_schema=schema, temperature=temperature)
        if self.thinking_level:
            kwargs["thinking_config"] = types.ThinkingConfig(thinking_level=self.thinking_level)
        config = types.GenerateContentConfig(**kwargs)
        started = time.monotonic()
        for attempt in range(self.max_retries + 1):
            try:
                resp = self._client.models.generate_content(model=self.model, contents=prompt, config=config)
                elapsed = time.monotonic() - started
                log.info("LLM %s %s: %.1fs (attempts %d)", self.model, schema.__name__, elapsed, attempt + 1)
                break
            except errors.APIError as e:
                if e.code not in RETRYABLE or attempt == self.max_retries:
                    raise LLMError(f"LLM API error {e.code}") from e
                delay = server_retry_delay(e)
                wait = min(delay + 1 if delay is not None else 2**attempt, 65)
                log.warning("LLM %s returned %s, retry %d in %.0fs", self.model, e.code, attempt + 1, wait)
                self._sleep(wait)
            except Exception as e:  # network / TLS
                raise LLMError(f"LLM request failed: {type(e).__name__}") from e
        parsed = getattr(resp, "parsed", None)
        if isinstance(parsed, schema):
            return parsed
        try:
            return schema.model_validate_json(resp.text or "")
        except Exception as e:
            raise LLMError("LLM returned output that does not match the schema") from e


def build_llm(settings) -> LLM:
    return GeminiLLM(api_key=settings.google_api_key, model=settings.llm_model)
