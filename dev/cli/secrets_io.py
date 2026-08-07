"""Reading and writing the central development secrets file.

Both `dev/cli` and the standalone `dev/setup-environment` script write this
file, so the rules for locking, quoting and permissions live here and nowhere
else. Keep this module to the standard library plus python-dotenv: the
setup-environment script depends on only those.
"""

import fcntl
import os
import shutil
import tempfile
from contextlib import contextmanager
from pathlib import Path

from dotenv import dotenv_values

SECRETS_FILE = Path(
    os.environ.get(
        "POLAR_SECRETS_FILE", Path.home() / ".config" / "polar" / "secrets.env"
    )
)
TEMPLATE_FILE = Path(__file__).parent.parent / "secrets.env.template"

_HEADER = (
    "# Polar Development Secrets\n"
    "# Shared across Git worktrees. See dev/secrets.env.template\n\n"
)


@contextmanager
def secrets_lock():
    """Serialize the whole read/merge/write so parallel runs don't drop keys.

    flock is per open file description, so this must not be nested: a second
    acquisition in the same process would block on the first.
    """
    SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock_path = SECRETS_FILE.with_name(f"{SECRETS_FILE.name}.lock")
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def quote(value: str) -> str:
    """Quote a value so any content survives a dotenv round-trip."""
    escaped = str(value).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def read_secrets() -> dict[str, str]:
    """Read the secrets file literally, keeping entries set to an empty string.

    Interpolation is off: a secret containing `${...}` is a literal value, not
    a reference to another entry.
    """
    if not SECRETS_FILE.exists():
        return {}
    return {
        k: v
        for k, v in dotenv_values(SECRETS_FILE, interpolate=False).items()
        if v is not None
    }


def _write(secrets: dict[str, str]) -> None:
    """Replace the secrets file atomically. Caller must hold the lock."""
    # mkstemp creates with 0600, and the rename is atomic, so the values are
    # never briefly world-readable and an interrupted write keeps the old file.
    fd, tmp_path = tempfile.mkstemp(
        dir=SECRETS_FILE.parent, prefix=f".{SECRETS_FILE.name}.", suffix=".tmp"
    )
    try:
        with os.fdopen(fd, "w") as f:
            f.write(_HEADER)
            for key, value in secrets.items():
                # The file has to stay plain text: dev/setup-environment reads it
                # to build server/.env, which docker compose loads as-is.
                f.write(f"{key}={quote(value)}\n")  # codeql[py/clear-text-storage-sensitive-data]
        os.replace(tmp_path, SECRETS_FILE)
    except BaseException:
        os.unlink(tmp_path)
        raise


def update_secrets(values: dict[str, str | None]) -> None:
    """Merge values into the secrets file, dropping keys set to None."""
    if not values:
        return

    with secrets_lock():
        secrets = read_secrets()
        for key, value in values.items():
            if value is None:
                secrets.pop(key, None)
            else:
                secrets[key] = value
        _write(secrets)


def ensure_secrets_file() -> bool:
    """Create the secrets file from the template. Returns True if it created one."""
    with secrets_lock():
        if SECRETS_FILE.exists():
            return False

        if TEMPLATE_FILE.exists():
            shutil.copy(TEMPLATE_FILE, SECRETS_FILE)
        else:
            SECRETS_FILE.write_text(_HEADER)
        SECRETS_FILE.chmod(0o600)
        return True
