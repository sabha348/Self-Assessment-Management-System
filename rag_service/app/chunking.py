"""Page-aware chunking.

All pages are joined into one string with a paragraph break between pages,
and chunking works on character *spans* of that string. Every chunk is an
exact slice `joined[char_start:char_end]`, so mapping a chunk back to the
pages it came from is exact: `page_start` is the page holding its first
character and `page_end` the page holding its last.

Splitting prefers natural boundaries: paragraphs, then sentences, then
words, and only cuts mid-word for pathological input. Neighbouring chunks
share up to `overlap` characters, aligned to those same boundaries, so a
fact that straddles a boundary is fully contained in at least one chunk.
"""

import bisect
import re
from dataclasses import dataclass

from .pdf import Page

PAGE_SEPARATOR = "\n\n"

_PARAGRAPH = re.compile(r"\n\s*\n")
_SENTENCE = re.compile(r"(?<=[.!?:;])\s+")
_WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True)
class Chunk:
    index: int
    text: str
    char_start: int
    char_end: int
    page_start: int
    page_end: int
    page_label_start: str
    page_label_end: str


@dataclass(frozen=True)
class JoinedDocument:
    text: str
    page_starts: list[int]  # char offset where each page begins in `text`
    pages: list[Page]

    def page_at(self, offset: int) -> Page:
        """The page containing character `offset`."""
        i = bisect.bisect_right(self.page_starts, offset) - 1
        return self.pages[max(i, 0)]


def join_pages(pages: list[Page]) -> JoinedDocument:
    parts, starts, pos = [], [], 0
    for i, page in enumerate(pages):
        if i:
            parts.append(PAGE_SEPARATOR)
            pos += len(PAGE_SEPARATOR)
        starts.append(pos)
        parts.append(page.text)
        pos += len(page.text)
    return JoinedDocument(text="".join(parts), page_starts=starts, pages=pages)


def _trim(text: str, start: int, end: int) -> tuple[int, int] | None:
    while start < end and text[start].isspace():
        start += 1
    while end > start and text[end - 1].isspace():
        end -= 1
    return (start, end) if start < end else None


def _split_on(pattern: re.Pattern, text: str, start: int, end: int) -> list[tuple[int, int]]:
    spans, cursor = [], start
    for m in pattern.finditer(text, start, end):
        span = _trim(text, cursor, m.start())
        if span:
            spans.append(span)
        cursor = m.end()
    span = _trim(text, cursor, end)
    if span:
        spans.append(span)
    return spans


def _units(text: str, start: int, end: int, size: int) -> list[tuple[int, int]]:
    """Split [start, end) into spans no longer than `size`, using the coarsest
    boundary that works."""
    span = _trim(text, start, end)
    if span is None:
        return []
    start, end = span
    if end - start <= size:
        return [(start, end)]
    for pattern in (_PARAGRAPH, _SENTENCE, _WHITESPACE):
        pieces = _split_on(pattern, text, start, end)
        if len(pieces) > 1:
            out: list[tuple[int, int]] = []
            for s, e in pieces:
                out.extend(_units(text, s, e, size))
            return out
    # A single "word" longer than size (e.g. a long URL or base64 blob).
    return [(s, min(s + size, end)) for s in range(start, end, size)]


def chunk_pages(pages: list[Page], size: int = 1500, overlap: int = 200) -> list[Chunk]:
    if size <= 0 or not 0 <= overlap < size:
        raise ValueError("need size > 0 and 0 <= overlap < size")
    doc = join_pages(pages)
    text = doc.text
    units = _units(text, 0, len(text), size)

    spans: list[tuple[int, int]] = []
    first = 0  # index of the first unit in the chunk being built
    i = 0
    while i < len(units):
        # Greedily extend the chunk with following units while it fits.
        j = i
        while j + 1 < len(units) and units[j + 1][1] - units[first][0] <= size:
            j += 1
        spans.append((units[first][0], units[j][1]))
        if j + 1 >= len(units):
            break
        # Next chunk: step back over trailing units that fit in `overlap`
        # (and still leave room for the next unit), but always make progress.
        nxt = j + 1
        back = nxt
        while (
            back - 1 > first
            and units[nxt][1] - units[back - 1][0] <= size
            and units[j][1] - units[back - 1][0] <= overlap
        ):
            back -= 1
        first = back
        i = nxt

    chunks = []
    for idx, (s, e) in enumerate(spans):
        p_start, p_end = doc.page_at(s), doc.page_at(e - 1)
        chunks.append(
            Chunk(
                index=idx,
                text=text[s:e],
                char_start=s,
                char_end=e,
                page_start=p_start.number,
                page_end=p_end.number,
                page_label_start=p_start.label,
                page_label_end=p_end.label,
            )
        )
    return chunks
