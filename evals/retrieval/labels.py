"""Load and validate the hand-written retrieval labels."""

import json
import re
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Label:
    id: str
    doc: str  # corpus file stem, e.g. "thinkpython2"
    question: str
    gold_pages: tuple[int, ...] = ()  # physical page numbers (the viewer's "page N of M")
    gold_page_labels: tuple[str, ...] = ()  # or the numbers printed on the pages
    tags: tuple[str, ...] = ()


def _parse_text_line(line: str, lineno: int, default_doc: str) -> dict:
    """`45, 46 | question text | optional,tags` -> label dict (physical pages)."""
    parts = [p.strip() for p in line.split("|")]
    if len(parts) < 2 or not parts[1]:
        raise ValueError(f"line {lineno}: expected 'pages | question'")
    try:
        pages = [int(p) for p in re.split(r"[,\s]+", parts[0]) if p]
    except ValueError:
        raise ValueError(f"line {lineno}: pages must be numbers, got {parts[0]!r}") from None
    tags = [t.strip() for t in parts[2].split(",") if t.strip()] if len(parts) > 2 else []
    return {"id": f"q{lineno:03d}", "doc": default_doc, "question": parts[1], "gold_pages": pages, "tags": tags}


def load_labels(path: Path, default_doc: str = "thinkpython2") -> list[Label]:
    """Read labels from JSONL (one object per line) or from a .txt file with
    lines like `45, 46 | What does ... ?` (physical page numbers)."""
    labels, seen = [], set()
    is_text = path.suffix == ".txt"
    for lineno, line in enumerate(path.read_text().splitlines(), start=1):
        line = line.strip()
        if not line or line.startswith(("//", "#")):
            continue
        if is_text:
            try:
                raw = _parse_text_line(line, lineno, default_doc)
            except ValueError as e:
                raise ValueError(f"{path}: {e}") from None
        else:
            try:
                raw = json.loads(line)
            except json.JSONDecodeError as e:
                raise ValueError(f"{path}:{lineno}: invalid JSON: {e}") from e
        if str(raw.get("id", "")).startswith("example"):
            continue  # template rows
        for key in ("id", "doc", "question"):
            if not str(raw.get(key, "")).strip():
                raise ValueError(f"{path}:{lineno}: missing '{key}'")
        label = Label(
            id=str(raw["id"]),
            doc=str(raw["doc"]),
            question=str(raw["question"]).strip(),
            gold_pages=tuple(int(p) for p in raw.get("gold_pages", [])),
            gold_page_labels=tuple(str(p) for p in raw.get("gold_page_labels", [])),
            tags=tuple(raw.get("tags", [])),
        )
        if not label.gold_pages and not label.gold_page_labels:
            raise ValueError(f"{path}:{lineno}: give gold_pages or gold_page_labels")
        if label.id in seen:
            raise ValueError(f"{path}:{lineno}: duplicate id {label.id!r}")
        seen.add(label.id)
        labels.append(label)
    return labels


def resolve_gold_pages(label: Label, page_labels: dict[str, list[int]], page_count: int) -> list[int]:
    """Physical page numbers for a label, mapping printed labels if needed."""
    pages = set(label.gold_pages)
    for printed in label.gold_page_labels:
        if printed not in page_labels:
            raise ValueError(f"{label.id}: page label {printed!r} not found in {label.doc}")
        pages.update(page_labels[printed])
    bad = [p for p in pages if not 1 <= p <= page_count]
    if bad:
        raise ValueError(f"{label.id}: pages {bad} outside 1..{page_count}")
    return sorted(pages)
