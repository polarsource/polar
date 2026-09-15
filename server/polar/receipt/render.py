import sys
import traceback

from pydantic import BaseModel

from polar.invoice.renderer import PDFRenderError, render_pdf

from .generator import Receipt, ReceiptGenerator

RENDER_TIMEOUT_SECONDS = 60.0


class ReceiptRenderRequest(BaseModel):
    receipt: Receipt


class ReceiptRenderError(Exception): ...


async def render_receipt_pdf(receipt: Receipt) -> bytes:
    payload = ReceiptRenderRequest(receipt=receipt).model_dump_json()
    try:
        return await render_pdf(_generate_pdf, payload, timeout=RENDER_TIMEOUT_SECONDS)
    except PDFRenderError as e:
        raise ReceiptRenderError(f"Receipt {e}") from e


def _generate_pdf(payload: str) -> bytes:
    request = ReceiptRenderRequest.model_validate_json(payload)
    generator = ReceiptGenerator(request.receipt, heading_title="Receipt")
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
