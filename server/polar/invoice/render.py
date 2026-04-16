import asyncio
import os
import sys
import traceback
from asyncio.subprocess import PIPE
from pathlib import Path

from pydantic import BaseModel

from .generator import Invoice, InvoiceGenerator

SERVER_DIRECTORY = Path(__file__).resolve().parents[2]
PASSTHROUGH_ENV_VARS = {
    "HOME",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "PATH",
    "PYTHONHOME",
    "PYTHONPATH",
    "SSL_CERT_DIR",
    "SSL_CERT_FILE",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "TMPDIR",
    "TZ",
    "VIRTUAL_ENV",
}


class InvoiceRenderRequest(BaseModel):
    invoice: Invoice
    heading_title: str = "Invoice"


class InvoiceRenderError(Exception): ...


def build_invoice_renderer_env() -> dict[str, str]:
    return {
        key: value
        for key, value in os.environ.items()
        if key.startswith("POLAR_") or key in PASSTHROUGH_ENV_VARS
    }


async def render_invoice_pdf(
    invoice: Invoice, *, heading_title: str = "Invoice"
) -> bytes:
    payload = InvoiceRenderRequest(
        invoice=invoice, heading_title=heading_title
    ).model_dump_json()
    process = await asyncio.create_subprocess_exec(
        sys.executable,
        "-m",
        "polar.invoice.render",
        stdin=PIPE,
        stdout=PIPE,
        stderr=PIPE,
        cwd=SERVER_DIRECTORY,
        env=build_invoice_renderer_env(),
    )
    stdout, stderr = await process.communicate(payload.encode("utf-8"))
    if process.returncode != 0:
        error = stderr.decode("utf-8").strip() or "unknown invoice renderer error"
        raise InvoiceRenderError(f"Invoice renderer failed: {error}")
    return stdout


def main() -> int:
    try:
        payload = InvoiceRenderRequest.model_validate_json(sys.stdin.buffer.read())
        generator = InvoiceGenerator(
            payload.invoice, heading_title=payload.heading_title
        )
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
