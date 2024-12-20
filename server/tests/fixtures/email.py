import asyncio
import os
import tempfile
import webbrowser
from collections.abc import Callable, Coroutine
from pathlib import Path
from types import TracebackType
from typing import TYPE_CHECKING, Any

import structlog
from watchfiles import awatch

from polar.email.sender import (
    DEFAULT_FROM_EMAIL_ADDRESS,
    DEFAULT_FROM_NAME,
    DEFAULT_REPLY_TO_EMAIL_ADDRESS,
    DEFAULT_REPLY_TO_NAME,
)

if TYPE_CHECKING:
    from tempfile import _TemporaryFileWrapper as TemporaryFileWrapper


class WatcherEmailRenderer:
    def __init__(self) -> None:
        self._temporary_file: TemporaryFileWrapper[str] | None = None
        super().__init__()

    def __enter__(self) -> "WatcherEmailRenderer":
        self._temporary_file = tempfile.NamedTemporaryFile(suffix=".html", mode="w")
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        self.temporary_file.close()

    def __call__(
        self,
        *,
        to_email_addr: str,
        subject: str,
        html_content: str,
        from_name: str = DEFAULT_FROM_NAME,
        from_email_addr: str = DEFAULT_FROM_EMAIL_ADDRESS,
        email_headers: dict[str, str] = {},
        reply_to_name: str | None = DEFAULT_REPLY_TO_NAME,
        reply_to_email_addr: str | None = DEFAULT_REPLY_TO_EMAIL_ADDRESS,
    ) -> None:
        self.temporary_file.seek(0)
        self.temporary_file.truncate(0)
        self.temporary_file.write(html_content)

    @property
    def path(self) -> str:
        return self.temporary_file.name

    @property
    def temporary_file(self) -> "TemporaryFileWrapper[str]":
        if self._temporary_file is None:
            raise RuntimeError(
                "Temporary file not created. "
                "You should use this class as a context manager."
            )
        return self._temporary_file


async def watch_email(
    refresher: Callable[[], Coroutine[Any, Any, Any]], file_path: str
) -> None:
    await refresher()
    await asyncio.sleep(1)
    if os.environ.get("POLAR_TEST_WATCH", False) == "1":
        logger = structlog.get_logger(path=file_path)
        logger.info("Opening email in browser")
        webbrowser.open("file://" + file_path)
        try:
            async for _ in awatch(Path(__file__).parent.parent.parent / "polar"):
                await refresher()
                logger.info("Email content refreshed")
        except (KeyboardInterrupt, asyncio.CancelledError):
            pass
