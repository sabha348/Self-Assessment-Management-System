# Grader agreement results

30 student answers to 10 grounded questions (*Think Python 2e*, pp. 66–198),
graded blind by the project owner on a 3-point scale (correct / partial /
incorrect) and by the auto-graders. Run on 2026-11-16. Raw data:
`summary.json`, `per_item.csv`.

**Order of events (see git history):** items committed (`6e3842c`), owner
grades them blind on a private page that showed neither the answers' design
categories nor any auto-grade, grades committed (`c960424`), then the
auto-graders run. Nothing was tuned on these 30 items.

## Headline

| grader | exact agreement | Cohen's κ | quadratic-weighted κ | correct vs not | correct↔incorrect errors |
|---|---|---|---|---|---|
| **New: point-based, grounded** (run 1) | **0.77** (23/30) | **0.65** | **0.84** | **0.97** | **0** |
| New, run 2 (same inputs) | 0.73 (22/30) | 0.60 | 0.81 | 0.97 | 0 |
| Legacy: holistic "Accuracy: NN" | 0.63* | 0.45* | 0.54* | 0.80 | 2 |

\* The legacy grader only decides correct (score ≥ 60) or not; for the
3-class columns its score is bucketed with the new grader's thresholds
(≥ 75 correct, ≥ 25 partial). Its own binary decision agrees with the
owner's correct-vs-not judgement 0.80 of the time.

**Run-to-run stability (new grader, temperature 0): 27/30 identical
verdicts.** The three that flipped (A08, A18, A30) all sit on the
partial/incorrect boundary (scores 17–25).

## Confusion matrix (new grader, run 1)

| owner ↓ / grader → | incorrect | partial | correct |
|---|---|---|---|
| incorrect (8) | 7 | 1 | 0 |
| partial (11) | **5** | 5 | 1 |
| correct (11) | 0 | 0 | 11 |

## Where it disagrees

All 7 disagreements are one step apart; none mixes up correct and incorrect.

| item | answer kind | owner | grader | point judgements | answer |
|---|---|---|---|---|---|
| A02 | partial | partial | incorrect (0) | missing ×3 | "It runs out of memory eventually and crashes." |
| A08 | partial | partial | incorrect (17) | partial / missing / missing | "break stops the loop." |
| A14 | partial | partial | incorrect (17) | missing / missing / partial | "Dictionaries are faster than lists." |
| A26 | partial | partial | incorrect (0) | missing ×3 | "A deep copy copies more than a shallow copy." |
| A27 | misconception | partial | incorrect (0) | missing ×3 | "A shallow copy only copies the first half of the attributes…" |
| A04 | terse-correct | partial | correct (100) | covered ×3 | "strings are immutable so you cant assign to an index" |
| A05 | keyword-stuffing | incorrect | partial (33) | partial / missing / partial | "TypeError happens because the bracket operator is immutable…" |

**Pattern: the grader is stricter than the owner on short, vague answers
that are on the right track** (5 of 11 owner-"partial" answers graded
incorrect). Each of these answers states a true but unspecific fact
("dictionaries are faster") without any of the key points' substance.
The owner gives credit for direction; the rubric gives credit for content.
The two over-grades go the other way: a terse but complete answer the owner
thought too thin (A04), and a keyword-heavy wrong answer that earned partial
credit for its terms (A05).

By answer kind (new grader agreement): paraphrase-correct 7/7,
typos-correct 1/1, correct-plus-wrong-claim 2/2, misconception 5/6,
partial 3/7, terse-correct 2/3, keyword-stuffing 1/2, off-topic 1/1, vague 1/1.
The legacy grader got paraphrase-correct right only 5/7 and terse-correct
1/3 on its correct-vs-not decision: the old character-similarity scoring
punished correct answers worded differently from the reference.

## What was not changed, and why

An obvious fix, "an answer with any partially covered point is at least
partial", was checked on these items **post hoc**: it fixes A08 and A14 but
breaks two others, 23/30 either way. Tuning thresholds on the evaluation
set would overstate agreement, so the grader is left as is; a change like
this needs a fresh, separately graded set.

## Limits

- 30 items and one human grader: κ has wide uncertainty at this size; the
  results show the error pattern more reliably than a precise κ.
- The student answers were written to cover grader failure modes (they are
  not real student work), so the mix of answer kinds is deliberate, not
  representative.
- Questions come from one programming textbook.
- Gemini returned 503 ("high demand") on many calls; a few grades in each run
  came from the fallback model (`gemini-3.1-flash-lite`), which is how the
  product behaves under load too.
