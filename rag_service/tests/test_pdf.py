import pytest

from app.pdf import PdfError, clean_text, extract_pages
from tests.pdf_factory import make_pdf


def test_pages_are_numbered_in_order_and_keep_their_text():
    data = make_pdf(["Alpha page about variables.", "Beta page about loops.", "Gamma page about recursion."])
    pages = extract_pages(data)
    assert [p.number for p in pages] == [1, 2, 3]
    assert "variables" in pages[0].text
    assert "loops" in pages[1].text
    assert "recursion" in pages[2].text
    # No page labels in this PDF, so the label falls back to the number.
    assert [p.label for p in pages] == ["1", "2", "3"]


def test_blank_pages_are_kept_so_numbering_matches_the_viewer():
    pages = extract_pages(make_pdf(["First.", "", "Third."]))
    assert [p.number for p in pages] == [1, 2, 3]
    assert pages[1].text == ""
    assert "Third" in pages[2].text


def test_rejects_non_pdf_and_text_less_pdf():
    with pytest.raises(PdfError):
        extract_pages(b"hello, not a pdf")
    with pytest.raises(PdfError, match="no extractable text"):
        extract_pages(make_pdf(["", ""]))


def test_rejects_corrupt_pdf():
    with pytest.raises(PdfError):
        extract_pages(b"%PDF-1.4 garbage that is not a real pdf")


def test_clean_text_joins_hyphenated_line_breaks_and_keeps_paragraphs():
    raw = "An exam-\nple of  text.\r\n\r\n\r\n\nNext   paragraph."
    assert clean_text(raw) == "An example of text.\n\nNext paragraph."


def test_printed_page_labels_are_read_when_present():
    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_font("Helvetica", size=11)
    pdf.add_page()
    pdf.set_page_label(label_style="r")
    pdf.cell(0, 10, "Preface text")
    pdf.add_page()
    pdf.cell(0, 10, "More preface")
    pdf.add_page()
    pdf.set_page_label(label_style="D", label_start=1)
    pdf.cell(0, 10, "Chapter one")
    pages = extract_pages(bytes(pdf.output()))
    # Physical numbers stay 1..3; labels follow the book's own numbering.
    assert [(p.number, p.label) for p in pages] == [(1, "i"), (2, "ii"), (3, "1")]
