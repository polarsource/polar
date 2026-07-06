import re
from io import BytesIO

from fpdf import FPDF
from PIL import Image

from polar.support_case.pdf import is_mergeable, merge_attachments


def _png_bytes(width: int = 32, height: int = 32) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (width, height), "red").save(buffer, format="PNG")
    return buffer.getvalue()


def _pdf_bytes(pages: int = 1) -> bytes:
    pdf = FPDF()
    for number in range(pages):
        pdf.add_page()
        pdf.set_font("Helvetica", size=10)
        pdf.cell(0, 6, f"page {number + 1}")
    return bytes(pdf.output())


def _page_count(pdf: bytes) -> int:
    return pdf.count(b"/Type /Page") - pdf.count(b"/Type /Pages")


class TestIsMergeable:
    def test_mime_types(self) -> None:
        assert is_mergeable("application/pdf") is True
        assert is_mergeable("image/png") is True
        assert is_mergeable("image/jpeg") is True
        assert is_mergeable("text/csv") is True
        assert is_mergeable("text/plain") is True
        assert is_mergeable("video/mp4") is False
        assert is_mergeable("application/msword") is False


class TestMergeAttachments:
    def test_combines_pdf_image_and_text(self) -> None:
        output = merge_attachments(
            [
                ("receipt.pdf", "application/pdf", _pdf_bytes(pages=2)),
                ("evidence.png", "image/png", _png_bytes()),
                ("orders.csv", "text/csv", b"id,amount\n1,100\n"),
            ]
        )
        assert output.startswith(b"%PDF")
        assert _page_count(output) == 4

    def test_unreadable_files_become_note_pages(self) -> None:
        data = _pdf_bytes()
        kids = re.search(rb"/Kids \[(\d+ 0 R)\]", data)
        assert kids is not None
        corrupt_tree = (
            data[: kids.start(1)]
            + b"(bad)".ljust(len(kids.group(1)), b" ")
            + data[kids.end(1) :]
        )

        output = merge_attachments(
            [
                ("broken.pdf", "application/pdf", b"%PDF-1.4 not really a pdf"),
                ("evil.pdf", "application/pdf", corrupt_tree),
                ("garbage.png", "image/png", b"not an image at all"),
                ("truncated.png", "image/png", _png_bytes()[:20]),
            ]
        )

        assert output.startswith(b"%PDF")
        assert _page_count(output) == 4

    def test_tall_image_stays_on_one_page(self) -> None:
        output = merge_attachments(
            [("tall.png", "image/png", _png_bytes(width=100, height=2000))]
        )
        assert output.startswith(b"%PDF")
        assert _page_count(output) == 1

    def test_non_latin_text_does_not_crash(self) -> None:
        output = merge_attachments(
            [("nöte.txt", "text/plain", "receipt — 100€ 領収書".encode())]
        )
        assert output.startswith(b"%PDF")
        assert _page_count(output) == 1
