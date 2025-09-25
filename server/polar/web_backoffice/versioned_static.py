import hashlib
from functools import lru_cache
from pathlib import Path

from starlette.staticfiles import StaticFiles


class VersionedStaticFiles(StaticFiles):
    """StaticFiles subclass for versioned static files."""

    @lru_cache(maxsize=32)
    def get_file_version(self, file_path: str) -> str:
        """Get version string for a file based on content hash."""
        try:
            if self.directory is None:
                return "1"
            path = Path(self.directory) / file_path
            if not path.exists():
                return "1"

            # Use content hash for Docker-compatible versioning
            with open(path, "rb") as f:
                content = f.read()
                hash_obj = hashlib.sha256(content)
                return hash_obj.hexdigest()[:8]

        except (OSError, ValueError):
            return "1"
