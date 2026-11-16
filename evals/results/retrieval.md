# Retrieval eval results

42 questions over *Think Python 2e* (244 pages), page-level gold labels
(`evals/data/retrieval_labels.txt`, committed before the first run).
Embeddings: `gemini-embedding-001`, 768-d, normalised. Run on 2026-11-16.
Raw summaries: `retrieval_1500_200.json`, `retrieval_800_100.json`.

## Default config: 1500-char chunks, 200 overlap (350 chunks)

| mode | recall@1 | recall@3 | recall@5 | recall@10 | MRR@5 |
|---|---|---|---|---|---|
| **dense** | **0.81** | **0.98** | **1.00** | 1.00 | **0.90** |
| keyword (Postgres FTS) | 0.24 | 0.55 | 0.74 | 0.86 | 0.42 |
| hybrid (RRF, k=60) | 0.62 | 0.88 | 0.91 | 0.98 | 0.75 |

95% Wilson intervals (n=42): dense recall@5 42/42 → [0.92, 1.00];
hybrid 38/42 → [0.78, 0.96]; keyword 31/42 → [0.59, 0.85].

recall@5 by question tag:

| tag | n | dense | keyword | hybrid |
|---|---|---|---|---|
| paraphrase | 19 | 1.00 | 0.74 | 0.84 |
| concept | 14 | 1.00 | 0.79 | 1.00 |
| exact-term | 9 | 1.00 | 0.67 | 0.89 |
| multi-page | 5 | 1.00 | 0.80 | 1.00 |

## Variant: 800-char chunks, 100 overlap (636 chunks)

| mode | recall@1 | recall@3 | recall@5 | recall@10 | MRR@5 |
|---|---|---|---|---|---|
| dense | 0.86 | 0.93 | 0.98 | 0.98 | 0.90 |
| keyword | 0.31 | 0.52 | 0.69 | 0.88 | 0.44 |
| hybrid | 0.71 | 0.88 | 0.91 | 0.95 | 0.80 |

## What this says

1. **Dense retrieval meets the target: recall@5 = 1.00 (42/42).** The right
   page is the top hit 81% of the time.
2. **Hybrid is worse than dense here, not better.** RRF gives the keyword
   ranking equal weight, and keyword search is weak on this corpus: the
   query ORs every stemmed word, so generic terms that appear on most pages
   ("function", "list", "value") dominate `ts_rank`. That is also why
   keyword search does *worst* on `exact-term` questions (0.67), where one
   would expect it to shine. So the service defaults to `dense`.
3. **Chunk size does not matter at this scale.** 800 vs 1500 characters
   differ by 1–2 questions on every metric (MRR identical at 0.90), well
   inside the intervals. 1500 is kept: 45% fewer chunks means 45% fewer
   embedding calls and faster ingestion on the free tier.
4. **Limits.** 42 questions is small; dense is at the ceiling for recall@5,
   so recall@1 and MRR are the more informative numbers for future changes.
   Questions are single-hop and about one book. Hybrid weights were
   deliberately *not* tuned on this set (that would be fitting to the test
   set); a weighted RRF or a better keyword query would need a separate
   held-out set.
