"""Agreement between an automatic grader and human grades.

Grades are ordinal: incorrect < partial < correct. Besides raw agreement we
report Cohen's kappa (agreement beyond chance) and quadratic-weighted kappa,
which penalises "correct vs incorrect" disagreements more than one-step
ones ("partial vs correct"), the standard choice for ordinal grades.
"""

from collections import Counter
from collections.abc import Sequence

LABELS = ("incorrect", "partial", "correct")


def confusion(human: Sequence[str], auto: Sequence[str], labels=LABELS) -> list[list[int]]:
    """matrix[i][j] = count of items the human graded labels[i] and the grader labels[j]."""
    idx = {lab: i for i, lab in enumerate(labels)}
    m = [[0] * len(labels) for _ in labels]
    for h, a in zip(human, auto, strict=True):
        m[idx[h]][idx[a]] += 1
    return m


def exact_agreement(human: Sequence[str], auto: Sequence[str]) -> float:
    return sum(h == a for h, a in zip(human, auto, strict=True)) / len(human) if human else 0.0


def cohen_kappa(human: Sequence[str], auto: Sequence[str], labels=LABELS, weights: str | None = None) -> float:
    """Cohen's kappa; weights=None (unweighted), 'linear' or 'quadratic'."""
    n = len(human)
    if n == 0:
        return 0.0
    k = len(labels)
    m = confusion(human, auto, labels)
    row = [sum(r) for r in m]
    col = [sum(m[i][j] for i in range(k)) for j in range(k)]

    def w(i, j):
        if weights is None:
            return 0.0 if i == j else 1.0
        d = abs(i - j) / (k - 1)
        return d if weights == "linear" else d * d

    observed = sum(w(i, j) * m[i][j] for i in range(k) for j in range(k)) / n
    expected = sum(w(i, j) * row[i] * col[j] for i in range(k) for j in range(k)) / (n * n)
    return 1.0 if expected == 0 else 1.0 - observed / expected


def direction(human: str, auto: str) -> str:
    """'over' if the grader was more generous than the human, 'under' if harsher."""
    d = LABELS.index(auto) - LABELS.index(human)
    return "agree" if d == 0 else "over" if d > 0 else "under"


def summarize(human: Sequence[str], auto: Sequence[str]) -> dict:
    binary_h = ["correct" if h == "correct" else "not" for h in human]
    binary_a = ["correct" if a == "correct" else "not" for a in auto]
    dirs = Counter(direction(h, a) for h, a in zip(human, auto, strict=True))
    return {
        "n": len(human),
        "exact_agreement": round(exact_agreement(human, auto), 3),
        "cohen_kappa": round(cohen_kappa(human, auto), 3),
        "quadratic_weighted_kappa": round(cohen_kappa(human, auto, weights="quadratic"), 3),
        "binary_agreement_correct_vs_not": round(exact_agreement(binary_h, binary_a), 3),
        "confusion_rows_human_cols_auto": confusion(human, auto),
        "over_graded": dirs["over"],
        "under_graded": dirs["under"],
        "two_step_errors": sum(abs(LABELS.index(h) - LABELS.index(a)) == 2 for h, a in zip(human, auto, strict=True)),
    }
