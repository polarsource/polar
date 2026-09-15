import multiprocessing
import os
import traceback
from collections.abc import Callable
from contextlib import redirect_stderr, redirect_stdout
from multiprocessing.connection import Connection

import anyio

RENDER_CONTEXT = multiprocessing.get_context("forkserver")
# Share imports, but reclaim the fonts and PDF state after every render.
RENDER_CONTEXT.set_forkserver_preload(["polar.invoice._renderer_bootstrap"])

PASSTHROUGH_ENV_VARS = {
    "HOME",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "LD_LIBRARY_PATH",
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


class PDFRenderError(Exception): ...


def build_renderer_env() -> dict[str, str]:
    return {
        key: value
        for key, value in os.environ.items()
        if key.startswith("POLAR_") or key in PASSTHROUGH_ENV_VARS
    }


async def render_pdf(
    generate: Callable[[str], bytes], payload: str, *, timeout: float | None = None
) -> bytes:
    reader, writer = RENDER_CONTEXT.Pipe(duplex=False)
    process = RENDER_CONTEXT.Process(
        target=_run_renderer, args=(generate, payload, writer)
    )
    try:
        with anyio.fail_after(timeout):
            await anyio.to_thread.run_sync(process.start)
            writer.close()
            result = await anyio.to_thread.run_sync(
                reader.recv_bytes, abandon_on_cancel=True
            )
    except TimeoutError:
        raise PDFRenderError(f"renderer timed out after {timeout}s")
    except EOFError:
        raise PDFRenderError("renderer exited without producing a PDF")
    finally:
        if process.pid is not None:
            if process.is_alive():
                process.kill()
            with anyio.CancelScope(shield=True):
                await anyio.to_thread.run_sync(process.join)
            process.close()
        reader.close()
        writer.close()

    if result[:1] != b"\x00":
        raise PDFRenderError(f"renderer failed: {result[1:].decode('utf-8')}")
    return result[1:]


def _run_renderer(
    generate: Callable[[str], bytes], payload: str, writer: Connection
) -> None:
    with (
        open(os.devnull, "w") as sink,
        redirect_stdout(sink),
        redirect_stderr(sink),
    ):
        try:
            writer.send_bytes(b"\x00" + generate(payload))
        except Exception:
            writer.send_bytes(b"\x01" + traceback.format_exc().encode("utf-8"))
        finally:
            writer.close()
