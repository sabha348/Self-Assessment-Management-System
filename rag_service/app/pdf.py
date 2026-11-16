"""PDF text extraction that keeps page numbers."""

import io
import re
from dataclasses import dataclass

from pypdf import PdfReader
from pypdf.errors import PdfReadError


class PdfError(ValueError):
    """The upload is not a readable PDF (or has no extractable text)."""


@dataclass(frozen=True)
class Page:
    number: int  # 1-based physical page index, what a PDF viewer navigates by
    label: str  # printed page label, e.g. "xii" or "37"; equals str(number) if the PDF has none
    text: str


_HYPHEN_BREAK = re.compile(r"(\w)-\n(\w)")
_SPACES = re.compile(r"[ \t ]+")
_MANY_NEWLINES = re.compile(r"\n{3,}")


def clean_text(text: str) -> str:
    """Normalise extracted text without losing paragraph structure."""
    text = text.replace("\r\n", "\n").replace("\r", "\n").replace("\x00", "")
    text = _HYPHEN_BREAK.sub(r"\1\2", text)  # "exam-\nple" -> "example"
    text = _SPACES.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    text = _MANY_NEWLINES.sub("\n\n", text)
    return text.strip()


def extract_pages(data: bytes) -> list[Page]:
    """Return one Page per PDF page, in order. Empty pages are kept (text="")
    so page numbering always matches the viewer."""
    if not data.startswith(b"%PDF"):
        raise PdfError("file is not a PDF")
    try:
        reader = PdfReader(io.BytesIO(data))
        if reader.is_encrypted:
            # Many PDFs are "encrypted" with an empty user password.
            if not reader.decrypt(""):
                raise PdfError("PDF is password protected")
        labels = list(reader.page_labels) if reader.page_labels else []
        pages = []
        for i, page in enumerate(reader.pages):
            label = labels[i] if i < len(labels) and labels[i] else str(i + 1)
            pages.append(Page(number=i + 1, label=label, text=clean_text(page.extract_text() or "")))
    except PdfReadError as e:
        raise PdfError(f"could not read PDF: {e}") from e

    if not any(p.text for p in pages):
        raise PdfError("PDF has no extractable text (scanned images need OCR)")
    return pages
