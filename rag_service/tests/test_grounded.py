import pytest

from app.grounded import (
    format_sources,
    generate_questions,
    grade_answer,
    is_non_answer,
    plain,
    verdict_for,
)
from app.store import Hit
from tests.fakes import ScriptedLLM


def hit(cid, page, text="A while loop repeats its body until the condition is false.", label=None):
    return Hit(cid, "doc", 0, page, page, label or str(page), label or str(page), text, 0.9)


HITS = [hit("c1", 66, label="44"), hit("c2", 67, text="Infinite recursion raises RecursionError.", label="45")]


def gen(questions, insufficient=False):
    return {"_GenOutput": {"insufficient_context": insufficient, "questions": questions}}


def q(text, sources, points=("p1", "p2")):
    return {"question": text, "reference_answer": "ref", "key_points": list(points), "source_ids": sources}


def test_sources_are_numbered_with_printed_page_labels():
    text, ids = format_sources(HITS)
    assert "[S1] (p. 44)" in text and "[S2] (p. 45)" in text
    assert ids["S2"].chunk_id == "c2"


def test_generation_keeps_only_questions_citing_retrieved_sources():
    llm = ScriptedLLM(
        gen(
            [
                q("**What** stops a loop?", ["S1"]),
                q("Made-up question?", ["S9"]),  # cites a source that was never retrieved
                q("No citation?", []),
                q("What happens with infinite recursion?", ["s2", "S2", "[S1]"]),
            ]
        )
    )
    res = generate_questions(llm, HITS, n=5)
    assert [x.question for x in res.questions] == ["What stops a loop?", "What happens with infinite recursion?"]
    assert res.dropped == 2
    # ids are normalised and de-duplicated, order kept
    assert [c.chunk_id for c in res.questions[1].citations] == ["c2", "c1"]
    assert res.questions[1].citations[0].page_label_start == "45"
    assert not res.insufficient_context


def test_generation_dedupes_and_caps_at_n():
    llm = ScriptedLLM(gen([q("Same?", ["S1"]), q("same?", ["S1"]), q("Other?", ["S2"]), q("Third?", ["S1"])]))
    res = generate_questions(llm, HITS, n=2)
    assert [x.question for x in res.questions] == ["Same?", "Other?"]


def test_generation_without_hits_never_calls_the_llm():
    llm = ScriptedLLM({})
    res = generate_questions(llm, [], n=3)
    assert res.questions == [] and res.insufficient_context and llm.prompts == []


def test_generation_marks_insufficient_when_nothing_survives():
    res = generate_questions(ScriptedLLM(gen([q("x?", ["S7"])])), HITS, n=3)
    assert res.questions == [] and res.insufficient_context


def test_prompt_contains_sources_focus_and_grounding_rules():
    llm = ScriptedLLM(gen([q("x?", ["S1"])]))
    generate_questions(llm, HITS, n=2, difficulty="hard", focus="while loops")
    p = llm.prompts[0]
    assert "ONLY the numbered sources" in p and "while loops" in p and "[S1] (p. 44)" in p
    assert "Do not use outside knowledge" in p


def grade_out(statuses, contradicts=False, sources=("S1",)):
    return {
        "_GradeOutput": {
            "points": [{"point": i + 1, "status": s, "reason": "r"} for i, s in enumerate(statuses)],
            "contradicts_sources": contradicts,
            "feedback": "Good **start**.",
            "source_ids": list(sources),
        }
    }


@pytest.mark.parametrize(
    "statuses,score,verdict",
    [
        (["covered", "covered"], 100, "correct"),
        (["covered", "partial"], 75, "correct"),
        (["partial", "partial"], 50, "partial"),
        (["covered", "missing"], 50, "partial"),
        (["partial", "missing"], 25, "partial"),
        (["missing", "missing"], 0, "incorrect"),
    ],
)
def test_score_is_computed_from_point_judgements(statuses, score, verdict):
    r = grade_answer(ScriptedLLM(grade_out(statuses)), "Q", "ref", ["a", "b"], HITS, "some answer")
    assert (r.score, r.verdict) == (score, verdict)
    assert r.missing_points == [p for p, s in zip(["a", "b"], statuses, strict=True) if s != "covered"]
    assert r.feedback == "Good start."


def test_contradiction_caps_the_grade():
    r = grade_answer(
        ScriptedLLM(grade_out(["covered", "covered"], contradicts=True)), "Q", "ref", ["a", "b"], HITS, "x"
    )
    assert r.score == 25 and r.verdict == "partial"


def test_unjudged_or_out_of_range_points_count_as_missing():
    out = grade_out(["covered"])
    out["_GradeOutput"]["points"].append({"point": 9, "status": "covered", "reason": "bogus"})
    r = grade_answer(ScriptedLLM(out), "Q", "ref", ["a", "b"], HITS, "x")
    assert r.point_status == ["covered", "missing"] and r.score == 50


@pytest.mark.parametrize("answer", ["", "  ", "I don't know", "idk.", "No idea!", "?"])
def test_non_answers_are_graded_without_an_llm_call(answer):
    llm = ScriptedLLM({})
    r = grade_answer(llm, "Q", "ref", ["a", "b"], HITS, answer)
    assert (r.verdict, r.score) == ("incorrect", 0) and llm.prompts == []
    assert r.citations  # still points the student at the pages to revisit


def test_feedback_citations_fall_back_to_the_question_sources():
    r = grade_answer(ScriptedLLM(grade_out(["covered"], sources=["S99"])), "Q", "ref", ["a"], HITS, "x")
    assert [c.chunk_id for c in r.citations] == ["c1", "c2"]


def test_helpers():
    assert plain("**bold** and `code`\n  text") == "bold and code text"
    assert is_non_answer("I dont know") and not is_non_answer("I know: it loops")
    assert verdict_for(0.75) == "correct" and verdict_for(0.74) == "partial" and verdict_for(0.24) == "incorrect"
