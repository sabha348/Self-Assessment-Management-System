"""Question generation and answer grading grounded in retrieved chunks.

Every claim must come from the numbered sources given to the model, and
every citation is checked in code: a question citing a source that was not
retrieved is dropped, not trusted.
"""

import re
from dataclasses import dataclass, field
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field

from .llm import LLM
from .store import Hit

MAX_SOURCE_CHARS = 2500  # per chunk in the prompt (chunks are ~1500 chars)
_MARKDOWN = re.compile(r"(\*\*|__|`)")


def plain(text: str) -> str:
    """Strip inline markdown the UI would otherwise show literally (**bold**)."""
    return re.sub(r"\s+", " ", _MARKDOWN.sub("", text or "")).strip()


def pages_label(hit: Hit) -> str:
    if hit.page_start == hit.page_end:
        return f"p. {hit.page_label_start}"
    return f"pp. {hit.page_label_start}-{hit.page_label_end}"


def format_sources(hits: list[Hit]) -> tuple[str, dict[str, Hit]]:
    """Number the chunks S1..Sn for the prompt; return text and id map."""
    blocks, ids = [], {}
    for i, h in enumerate(hits, start=1):
        sid = f"S{i}"
        ids[sid] = h
        blocks.append(f"[{sid}] ({pages_label(h)})\n{h.text[:MAX_SOURCE_CHARS]}")
    return "\n\n".join(blocks), ids


@dataclass(frozen=True)
class Citation:
    chunk_id: str
    page_start: int
    page_end: int
    page_label_start: str
    page_label_end: str
    snippet: str


def to_citation(hit: Hit, snippet_chars: int = 220) -> Citation:
    text = hit.text.replace("\n", " ")
    snippet = text[:snippet_chars] + ("…" if len(text) > snippet_chars else "")
    return Citation(hit.chunk_id, hit.page_start, hit.page_end, hit.page_label_start, hit.page_label_end, snippet)


def resolve_sources(source_ids: list[str], id_map: dict[str, Hit]) -> list[Hit]:
    """Keep only ids that were actually given to the model, in order, once."""
    seen, out = set(), []
    for sid in source_ids:
        sid = sid.strip().strip("[]").upper()
        if sid in id_map and sid not in seen:
            seen.add(sid)
            out.append(id_map[sid])
    return out


# -- question generation -------------------------------------------------------


class Difficulty(StrEnum):
    easy = "easy"
    medium = "medium"
    hard = "hard"
    mixed = "mixed"


class _GenQuestion(BaseModel):
    question: str
    reference_answer: str
    key_points: list[str] = Field(description="2-5 short facts a complete answer must contain")
    source_ids: list[str] = Field(description="ids like S1 of the sources that support the answer")


class _GenOutput(BaseModel):
    insufficient_context: bool = Field(description="true if the sources cannot support the requested questions")
    questions: list[_GenQuestion]


DIFFICULTY_GUIDE = {
    "easy": "recall of a definition or fact stated in the sources",
    "medium": "explaining how or why something works, using the sources",
    "hard": "applying or comparing ideas from the sources to a small new example",
    "mixed": "a mix of recall, explanation and application",
}


def question_prompt(sources: str, n: int, difficulty: str, focus: str | None) -> str:
    focus_line = ""
    if focus:
        focus_line = f'\nThe student is currently reading this passage; prefer it:\n"""{focus[:1500]}"""\n'
    return f"""You write self-assessment questions for a student, using ONLY the numbered sources below.

Rules:
- Every question must be answerable from the sources alone. Do not use outside knowledge.
- The reference answer must be fully supported by the sources you cite in source_ids.
- key_points: 2-5 short, checkable facts that a complete answer must contain, each taken from the sources.
- Questions must stand alone: never say "according to the text" or "in the passage".
- Plain text only, no markdown.
- Difficulty: {DIFFICULTY_GUIDE.get(difficulty, DIFFICULTY_GUIDE["medium"])}.
- If the sources do not contain enough substance for {n} good questions, write fewer and set
  insufficient_context to true. Never invent content.
{focus_line}
Write up to {n} questions.

SOURCES:
{sources}"""


@dataclass
class GeneratedQuestion:
    question: str
    reference_answer: str
    key_points: list[str]
    citations: list[Citation]


@dataclass
class GenerationResult:
    questions: list[GeneratedQuestion]
    insufficient_context: bool
    dropped: int = 0  # questions removed because their citations did not check out
    retrieved: list[Citation] = field(default_factory=list)


def generate_questions(
    llm: LLM, hits: list[Hit], n: int, difficulty: str = "medium", focus: str | None = None
) -> GenerationResult:
    if not hits:
        return GenerationResult([], insufficient_context=True)
    sources, id_map = format_sources(hits)
    out = llm.generate_json(question_prompt(sources, n, difficulty, focus), _GenOutput, temperature=0.4)

    kept, dropped, seen = [], 0, set()
    for q in out.questions:
        cited = resolve_sources(q.source_ids, id_map)
        key_points = [plain(p) for p in q.key_points if plain(p)]
        text = plain(q.question)
        if not cited or not text or not plain(q.reference_answer) or len(key_points) < 1:
            dropped += 1  # unsupported or malformed: never shown to the student
            continue
        if text.lower() in seen:
            dropped += 1
            continue
        seen.add(text.lower())
        kept.append(GeneratedQuestion(text, plain(q.reference_answer), key_points[:5], [to_citation(h) for h in cited]))
        if len(kept) == n:
            break
    return GenerationResult(
        kept,
        insufficient_context=out.insufficient_context or not kept,
        dropped=dropped,
        retrieved=[to_citation(h) for h in hits],
    )


# -- grading -------------------------------------------------------------------

PointStatus = Literal["covered", "partial", "missing"]


class _PointJudgement(BaseModel):
    point: int = Field(description="1-based index of the key point")
    status: PointStatus
    reason: str = Field(description="one short sentence")


class _GradeOutput(BaseModel):
    points: list[_PointJudgement]
    contradicts_sources: bool = Field(description="true if the answer states something the sources contradict")
    feedback: str = Field(description="2-3 sentences to the student, plain text")
    source_ids: list[str] = Field(description="ids of sources that support the feedback")


# Score from per-point judgements, computed in code (not asked from the LLM):
# narrow yes/partial/no decisions are more consistent than a holistic 0-100.
POINT_VALUE = {"covered": 1.0, "partial": 0.5, "missing": 0.0}
CORRECT_AT, PARTIAL_AT = 0.75, 0.25

_NON_ANSWERS = {"", "idk", "i dont know", "i don't know", "dont know", "don't know", "no idea", "not sure", "?"}


def is_non_answer(answer: str) -> bool:
    return re.sub(r"[.!\s]+$", "", (answer or "").strip().lower()) in _NON_ANSWERS


def verdict_for(score: float) -> str:
    return "correct" if score >= CORRECT_AT else "partial" if score >= PARTIAL_AT else "incorrect"


def grade_prompt(question: str, reference: str, key_points: list[str], sources: str, answer: str) -> str:
    points = "\n".join(f"{i}. {p}" for i, p in enumerate(key_points, start=1))
    return f"""You grade a student's answer against key points, using ONLY the numbered sources.

QUESTION: {question}
REFERENCE ANSWER: {reference}
KEY POINTS:
{points}

STUDENT ANSWER: \"\"\"{answer[:3000]}\"\"\"

For EACH key point decide:
- covered: the answer states it (any wording; meaning matters, not exact words)
- partial: the answer gets part of it or is vague about it
- missing: absent or wrong
Judge meaning, not style or spelling. Do not reward length or repetition.
Set contradicts_sources if the answer makes a claim the sources contradict.
feedback: 2-3 plain-text sentences telling the student what they got right and what to revisit,
based only on the sources. Cite supporting sources in source_ids.

SOURCES:
{sources}"""


@dataclass
class GradeResult:
    verdict: str  # correct | partial | incorrect
    score: int  # 0-100
    point_status: list[str]
    missing_points: list[str]
    feedback: str
    citations: list[Citation]


def grade_answer(
    llm: LLM, question: str, reference: str, key_points: list[str], hits: list[Hit], answer: str
) -> GradeResult:
    key_points = [p for p in key_points if p.strip()] or [reference]
    if is_non_answer(answer):
        return GradeResult(
            "incorrect", 0, ["missing"] * len(key_points), key_points,
            "No answer was given. Review the cited pages and try again.", [to_citation(h) for h in hits[:2]],
        )  # fmt: skip
    sources, id_map = format_sources(hits)
    out = llm.generate_json(grade_prompt(question, reference, key_points, sources, answer), _GradeOutput, 0.0)

    status = ["missing"] * len(key_points)
    for j in out.points:
        if 1 <= j.point <= len(key_points):
            status[j.point - 1] = j.status
    score = sum(POINT_VALUE[s] for s in status) / len(status)
    if out.contradicts_sources:
        score = min(score, PARTIAL_AT)  # a confident wrong claim caps the grade
    cited = resolve_sources(out.source_ids, id_map) or hits[:2]
    return GradeResult(
        verdict=verdict_for(score),
        score=round(score * 100),
        point_status=status,
        missing_points=[p for p, s in zip(key_points, status, strict=True) if s != "covered"],
        feedback=plain(out.feedback),
        citations=[to_citation(h) for h in cited],
    )
