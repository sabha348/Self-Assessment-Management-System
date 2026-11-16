import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "grading"))

from agreement import cohen_kappa, confusion, direction, exact_agreement, summarize  # noqa: E402


def test_perfect_agreement():
    h = ["correct", "partial", "incorrect", "correct"]
    assert exact_agreement(h, h) == 1.0
    assert cohen_kappa(h, h) == pytest.approx(1.0)
    assert cohen_kappa(h, h, weights="quadratic") == pytest.approx(1.0)


def test_kappa_matches_a_hand_computed_example():
    # 2x2-style example inside 3 labels: po = 0.7, pe = 0.5 -> kappa = 0.4
    h = ["correct"] * 5 + ["incorrect"] * 5
    a = ["correct"] * 4 + ["incorrect"] + ["correct"] * 2 + ["incorrect"] * 3
    assert exact_agreement(h, a) == pytest.approx(0.7)
    assert cohen_kappa(h, a) == pytest.approx(0.4)


def test_weighted_kappa_penalises_two_step_errors_more():
    h = ["correct", "partial", "incorrect"] * 4
    one_step = ["partial", "partial", "incorrect"] * 4  # correct -> partial
    two_step = ["incorrect", "partial", "incorrect"] * 4  # correct -> incorrect
    assert cohen_kappa(h, one_step, weights="quadratic") > cohen_kappa(h, two_step, weights="quadratic")
    # unweighted kappa can't tell them apart
    assert cohen_kappa(h, one_step) == pytest.approx(cohen_kappa(h, two_step))


def test_constant_grader_has_zero_kappa():
    h = ["correct", "partial", "incorrect", "correct"]
    assert cohen_kappa(h, ["correct"] * 4) == pytest.approx(0.0)


def test_confusion_direction_and_summary():
    h = ["correct", "partial", "incorrect", "incorrect"]
    a = ["correct", "correct", "partial", "correct"]
    assert confusion(h, a) == [[0, 1, 1], [0, 0, 1], [0, 0, 1]]
    assert direction("partial", "correct") == "over" and direction("correct", "incorrect") == "under"
    s = summarize(h, a)
    assert (s["over_graded"], s["under_graded"], s["two_step_errors"]) == (3, 0, 1)
    assert s["binary_agreement_correct_vs_not"] == 0.5
