import hashlib
from functools import lru_cache
from pathlib import Path

from starlette.staticfiles import StaticFiles


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

    def get_file_version(self, file_path: str) -> str:
        """Get version string for a file based on content hash."""
        if self.directory is None:
            return "1"
        return get_file_version(str(self.directory), file_path)
