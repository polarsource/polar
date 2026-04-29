import asyncio
import sys
import traceback
from asyncio.subprocess import PIPE
from pathlib import Path

from pydantic import BaseModel

from polar.invoice.render import build_invoice_renderer_env

from .generator import Receipt, ReceiptGenerator

SERVER_DIRECTORY = Path(__file__).resolve().parents[2]

RENDER_TIMEOUT_SECONDS = 60.0
KILL_WAIT_SECONDS = 5.0


class ReceiptRenderRequest(BaseModel):
    receipt: Receipt


class ReceiptRenderError(Exception): ...


async def render_receipt_pdf(receipt: Receipt) -> bytes:
    payload = ReceiptRenderRequest(receipt=receipt).model_dump_json()
    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "polar.receipt.render",
        stdin=PIPE,
        stdout=PIPE,
        stderr=PIPE,
        cwd=SERVER_DIRECTORY,
        env=build_invoice_renderer_env(),
    )
    try:
        stdout, stderr = await asyncio.wait_for(
            process.communicate(payload.encode("utf-8")),
            timeout=RENDER_TIMEOUT_SECONDS,
        )
    except TimeoutError:
        process.kill()
        try:
            await asyncio.wait_for(process.wait(), timeout=KILL_WAIT_SECONDS)
        except TimeoutError:
            pass
        raise ReceiptRenderError(
            f"Receipt renderer timed out after {RENDER_TIMEOUT_SECONDS}s"
        )

    if process.returncode != 0:
        error = stderr.decode("utf-8").strip() or "unknown receipt renderer error"
        raise ReceiptRenderError(f"Receipt renderer failed: {error}")
    return stdout


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
