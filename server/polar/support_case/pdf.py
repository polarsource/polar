from collections.abc import Sequence
from io import BytesIO

from fpdf import FPDF
from pypdf import PdfReader, PdfWriter

_TEXT_MIME_TYPES = frozenset({"text/plain", "text/csv"})


def is_mergeable(mime_type: str) -> bool:
    """Types ``merge_attachments`` can combine: PDFs, images and plain text."""
    return (
        mime_type == "application/pdf"
        or mime_type.startswith("image/")
        or mime_type in _TEXT_MIME_TYPES
    )


def merge_attachments(files: Sequence[tuple[str, str, bytes]]) -> bytes:
    """Combine ``(name, mime_type, content)`` attachments into a single PDF.

    Unreadable files become note pages instead of failing the merge — mime
    types are client-declared and may not match the content.
    """
    writer = PdfWriter()
    for name, mime_type, content in files:
        if mime_type == "application/pdf":
            # pypdf raises non-PyPdfError exceptions on some malformed inputs.
            try:
                writer.append(PdfReader(BytesIO(content)))
            except Exception:
                note = (
                    f"Could not include {name}: the PDF is unreadable "
                    "(corrupt or password-protected)."
                )
                writer.append(PdfReader(BytesIO(_note_page(note))))
        else:
            try:
                page = _content_page(name, mime_type, content)
            except Exception:
                note = (
                    f"Could not include {name}: the file could not be "
                    f"rendered as {mime_type}."
                )
                page = _note_page(note)
            writer.append(PdfReader(BytesIO(page)))
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def _content_page(name: str, mime_type: str, content: bytes) -> bytes:
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", style="B", size=10)
    pdf.cell(0, 6, _latin1(name))
    pdf.ln(10)
    if mime_type.startswith("image/"):
        pdf.image(
            BytesIO(content),
            w=pdf.epw,
            h=pdf.page_break_trigger - pdf.y,
            keep_aspect_ratio=True,
        )
    else:
        pdf.set_font("Courier", size=9)
        pdf.multi_cell(0, 4, _latin1(content.decode("utf-8", errors="replace")))
    return bytes(pdf.output())


def _note_page(note: str) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", style="I", size=10)
    pdf.multi_cell(0, 6, _latin1(note))
    return bytes(pdf.output())


def _latin1(value: str) -> str:
    """Fit text to fpdf2's built-in fonts, which only cover latin-1."""
    return value.encode("latin-1", "replace").decode("latin-1")
