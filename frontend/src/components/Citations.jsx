import React from 'react';

/** "p. 44" or "pp. 44–45", using the page numbers printed in the book. */
export function formatPages(c) {
  const start = c.pageLabelStart ?? c.pageStart;
  const end = c.pageLabelEnd ?? c.pageEnd;
  return start === end ? `p. ${start}` : `pp. ${start}–${end}`;
}

/** Older (non-grounded) answers sometimes contain markdown like **bold**. */
export function stripMarkdown(text) {
  return typeof text === 'string' ? text.replace(/\*\*|__|`/g, '') : text;
}

/** De-duplicate citations that point at the same page range. */
function uniqueByPages(citations) {
  const seen = new Set();
  return (citations || []).filter((c) => {
    const key = `${c.pageStart}-${c.pageEnd}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Page citations as small chips. With onJump, chips are buttons that take
 * the reader to the cited page (physical page index); otherwise plain text.
 */
export function CitationChips({ citations, onJump, label = 'Source' }) {
  const items = uniqueByPages(citations);
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="citations">
      <span className="text-gray-500">{label}:</span>
      {items.map((c) =>
        onJump ? (
          <button
            key={`${c.pageStart}-${c.pageEnd}`}
            type="button"
            title={c.snippet}
            onClick={() => onJump(c.pageStart)}
            className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100"
          >
            {formatPages(c)}
          </button>
        ) : (
          <span
            key={`${c.pageStart}-${c.pageEnd}`}
            title={c.snippet}
            className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200"
          >
            {formatPages(c)}
          </span>
        )
      )}
    </div>
  );
}

const VERDICT_STYLES = {
  correct: { box: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-800', text: 'Correct' },
  partial: { box: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-800', text: 'Partially correct' },
  incorrect: { box: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-800', text: 'Incorrect' },
};

export function verdictOf(result) {
  if (result.verdict && VERDICT_STYLES[result.verdict]) return result.verdict;
  return result.status === 'correct' ? 'correct' : 'incorrect';
}

export function verdictStyle(result) {
  return VERDICT_STYLES[verdictOf(result)];
}

export function VerdictBadge({ result }) {
  const s = verdictStyle(result);
  return (
    <span className={`px-2 py-1 rounded-full text-sm ${s.badge}`}>
      {s.text} · {Math.round(result.accuracy ?? 0)}%
    </span>
  );
}
