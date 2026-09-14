import sys
import traceback

from pydantic import BaseModel

from .generator import Invoice, InvoiceGenerator
from .renderer import PDFRenderError, render_pdf


class InvoiceRenderRequest(BaseModel):
    invoice: Invoice
    heading_title: str = "Invoice"


class InvoiceRenderError(Exception): ...


async def render_invoice_pdf(
    invoice: Invoice, *, heading_title: str = "Invoice"
) -> bytes:
    payload = InvoiceRenderRequest(
        invoice=invoice, heading_title=heading_title
    ).model_dump_json()
    try:
        return await render_pdf(_generate_pdf, payload)
    except PDFRenderError as e:
        raise InvoiceRenderError(f"Invoice {e}") from e


def _generate_pdf(payload: str) -> bytes:
    request = InvoiceRenderRequest.model_validate_json(payload)
    generator = InvoiceGenerator(request.invoice, heading_title=request.heading_title)
    generator.generate()
    output = generator.output()
    assert isinstance(output, bytearray)
    return bytes(output)


def main() -> int:
    try:
        sys.stdout.buffer.write(_generate_pdf(sys.stdin.read()))
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
