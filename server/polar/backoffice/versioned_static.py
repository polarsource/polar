import hashlib
import os
from functools import lru_cache
from pathlib import Path

from starlette.datastructures import QueryParams
from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import Response
from starlette.staticfiles import StaticFiles
from starlette.types import Receive, Scope, Send

# Only a `?v=` matching the served file's content hash may be cached for good.
# During a rolling deploy an old instance can answer a new `?v=` (or the other
# way round), so anything else must revalidate its ETag on every use.
VERSIONED_CACHE_CONTROL = "public, max-age=31536000, immutable"
REVALIDATE_CACHE_CONTROL = "no-cache"


@lru_cache(maxsize=32)
def get_file_version(directory: str, file_path: str) -> str:
    try:
        path = Path(directory) / file_path
        if not path.exists():
            return "1"
        return hashlib.sha256(path.read_bytes()).hexdigest()[:8]
    except OSError, ValueError:
        return "1"


class VersionedStaticFiles(StaticFiles):
    """StaticFiles subclass for versioned static files."""

    def __init__(self, *, directory: str | os.PathLike[str]) -> None:
        super().__init__(directory=directory)
        self._gzip = GZipMiddleware(super().__call__, compresslevel=6)

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        await self._gzip(scope, receive, send)

    def file_response(
        self,
        full_path: str | os.PathLike[str],
        stat_result: os.stat_result,
        scope: Scope,
        status_code: int = 200,
    ) -> Response:
        response = super().file_response(full_path, stat_result, scope, status_code)
        requested_version = QueryParams(scope["query_string"]).get("v")
        served_version = self.get_file_version(
            os.path.relpath(full_path, self.directory)
        )
        response.headers["Cache-Control"] = (
            VERSIONED_CACHE_CONTROL
            if requested_version == served_version
            else REVALIDATE_CACHE_CONTROL
        )
        return response

    def get_file_version(self, file_path: str) -> str:
        """Get version string for a file based on content hash."""
        if self.directory is None:
            return "1"
        return get_file_version(str(self.directory), file_path)
