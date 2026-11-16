from types import SimpleNamespace

import pytest
from google.genai import errors
from pydantic import BaseModel

from app.llm import GeminiLLM, LLMError


class Out(BaseModel):
    answer: str


class FakeModels:
    def __init__(self, script, retry_delay=None):
        self.script = script  # model name -> list of status codes to fail with before succeeding
        self.retry_delay = retry_delay
        self.calls = []

    def generate_content(self, model, contents, config):
        self.calls.append((model, getattr(config, "thinking_config", None) is not None))
        failures = self.script.get(model, [])
        if failures:
            details = [{"@type": "x.RetryInfo", "retryDelay": self.retry_delay}] if self.retry_delay else []
            raise errors.APIError(failures.pop(0), {"error": {"message": "x", "details": details}})
        return SimpleNamespace(parsed=Out(answer=model), text=f'{{"answer": "{model}"}}')


def make(script, fallback="backup"):
    models = FakeModels(script)
    llm = GeminiLLM(
        client=SimpleNamespace(models=models),
        model="primary",
        fallback_model=fallback,
        max_retries=2,
        sleep=lambda s: None,
    )
    return llm, models


def test_primary_succeeds_after_retries():
    llm, models = make({"primary": [503, 503]})
    assert llm.generate_json("p", Out).answer == "primary"
    assert [m for m, _ in models.calls] == ["primary"] * 3


def test_falls_back_when_primary_stays_overloaded():
    llm, models = make({"primary": [503, 503, 503]})
    assert llm.generate_json("p", Out).answer == "backup"
    assert models.calls[-1] == ("backup", False)  # no thinking config on the fallback
    assert models.calls[0] == ("primary", True)


def test_no_fallback_for_client_errors():
    llm, models = make({"primary": [400]})
    with pytest.raises(LLMError, match="400"):
        llm.generate_json("p", Out)
    assert [m for m, _ in models.calls] == ["primary"]


def test_both_overloaded_raises():
    llm, _ = make({"primary": [503] * 3, "backup": [503] * 3})
    with pytest.raises(LLMError, match="primary and fallback"):
        llm.generate_json("p", Out)


def test_fallback_disabled():
    llm, _ = make({"primary": [429] * 3}, fallback=None)
    with pytest.raises(LLMError, match="429"):
        llm.generate_json("p", Out)


def test_timeout_goes_straight_to_the_fallback():
    class ReadTimeout(Exception):
        pass

    class Slow(FakeModels):
        def generate_content(self, model, contents, config):
            if model == "primary":
                self.calls.append((model, True))
                raise ReadTimeout("slow")
            return super().generate_content(model, contents, config)

    models = Slow({})
    llm = GeminiLLM(
        client=SimpleNamespace(models=models),
        model="primary",
        fallback_model="backup",
        max_retries=3,
        sleep=lambda s: None,
    )
    assert llm.generate_json("p", Out).answer == "backup"
    assert [m for m, _ in models.calls] == ["primary", "backup"]  # no retries on the slow model


def test_long_server_delay_switches_model_instead_of_waiting():
    models = FakeModels({"primary": [429]}, retry_delay="58s")
    slept = []
    llm = GeminiLLM(
        client=SimpleNamespace(models=models),
        model="primary",
        fallback_model="backup",
        max_retries=3,
        sleep=slept.append,
    )
    assert llm.generate_json("p", Out).answer == "backup"
    assert slept == []  # did not wait a minute for the quota
    assert [m for m, _ in models.calls] == ["primary", "backup"]


def test_short_server_delay_is_honoured():
    models = FakeModels({"primary": [429]}, retry_delay="3s")
    slept = []
    llm = GeminiLLM(
        client=SimpleNamespace(models=models),
        model="primary",
        fallback_model="backup",
        max_retries=3,
        sleep=slept.append,
    )
    assert llm.generate_json("p", Out).answer == "primary"
    assert slept == [4.0]
