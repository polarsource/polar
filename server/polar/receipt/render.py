import sys
import traceback
from pathlib import Path

import anyio
from pydantic import BaseModel

from polar.invoice.render import build_invoice_renderer_env

from .generator import Receipt, ReceiptGenerator

SERVER_DIRECTORY = Path(__file__).resolve().parents[2]

RENDER_TIMEOUT_SECONDS = 60.0


class ReceiptRenderRequest(BaseModel):
    receipt: Receipt


class ReceiptRenderError(Exception): ...


async def render_receipt_pdf(receipt: Receipt) -> bytes:
    payload = ReceiptRenderRequest(receipt=receipt).model_dump_json()
    try:
        with anyio.fail_after(RENDER_TIMEOUT_SECONDS):
            process = await anyio.run_process(
                [sys.executable, "-m", "polar.receipt.render"],
                input=payload.encode("utf-8"),
                check=False,
                cwd=SERVER_DIRECTORY,
                env=build_invoice_renderer_env(),
            )
    except TimeoutError:
        raise ReceiptRenderError(
            f"Receipt renderer timed out after {RENDER_TIMEOUT_SECONDS}s"
        )

    if process.returncode != 0:
        assert process.stderr is not None
        error = (
            process.stderr.decode("utf-8").strip() or "unknown receipt renderer error"
        )
        raise ReceiptRenderError(f"Receipt renderer failed: {error}")
    assert process.stdout is not None
    return process.stdout


def main() -> int:
    try:
        payload = ReceiptRenderRequest.model_validate_json(sys.stdin.buffer.read())
        generator = ReceiptGenerator(payload.receipt, heading_title="Receipt")
        generator.generate()
        output = generator.output()
        assert isinstance(output, bytearray)
        sys.stdout.buffer.write(output)
    except Exception:
        traceback.print_exc(file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
