"""Shared utilities and context for the Polar Development CLI."""

import fcntl
import os
import shutil
import socket
import subprocess
import tempfile
from contextlib import contextmanager
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import dotenv_values
from rich.console import Console
from rich.live import Live
from rich.padding import Padding
from rich.spinner import Spinner
from rich.text import Text

console = Console()
ROOT_DIR = Path(__file__).parent.parent.parent.resolve()
SERVER_DIR = ROOT_DIR / "server"
CLIENTS_DIR = ROOT_DIR / "clients"
DEFAULT_API_PORT = 8000
DEFAULT_WEB_PORT = 3000
DEFAULT_DB_PORT = 5432
DEFAULT_REDIS_PORT = 6379
DEFAULT_MINIO_PORT = 9000
DEFAULT_TINYBIRD_PORT = 7181
SECRETS_FILE = Path(
    os.environ.get(
        "POLAR_SECRETS_FILE", Path.home() / ".config" / "polar" / "secrets.env"
    )
)


@dataclass
class Context:
    """Shared context passed to each step."""

    clean: bool = False
    skip_integrations: bool = False
    skip_tinybird: bool = False
    database_name: str | None = None
    state: dict = field(default_factory=dict)


def read_secrets() -> dict[str, str]:
    """Read the central secrets file literally.

    Interpolation is off: a secret containing `${...}` is a literal value here,
    not a reference to another entry.
    """
    if not SECRETS_FILE.exists():
        return {}
    return {
        k: v
        for k, v in dotenv_values(SECRETS_FILE, interpolate=False).items()
        if v is not None
    }


@contextmanager
def _secrets_lock():
    """Serialize read/merge/write so parallel worktrees don't drop each other's keys."""
    SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock_path = SECRETS_FILE.with_name(f"{SECRETS_FILE.name}.lock")
    fd = os.open(lock_path, os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)


def _quote(value: str) -> str:
    """Quote a value so any content survives a dotenv round-trip."""
    escaped = value.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def update_secrets(values: dict[str, str | None]) -> None:
    """Merge values into the central secrets file, dropping keys set to None.

    Values are written quoted and escaped, so multi-line secrets such as the
    GitHub App private key survive a rewrite intact. The file is replaced
    atomically, so an interrupted write can't destroy the previous contents.
    """
    if not values:
        return

    with _secrets_lock():
        secrets = read_secrets()
        for key, value in values.items():
            if value is None:
                secrets.pop(key, None)
            else:
                secrets[key] = value

        # mkstemp creates with 0600, so the values are never briefly world-readable.
        fd, tmp_path = tempfile.mkstemp(
            dir=SECRETS_FILE.parent, prefix=f".{SECRETS_FILE.name}.", suffix=".tmp"
        )
        try:
            with os.fdopen(fd, "w") as f:
                f.write("# Polar Development Secrets\n")
                f.write("# Shared across Git worktrees. See dev/secrets.env.template\n\n")
                for key, value in secrets.items():
                    # The file has to stay plain text: dev/setup-environment reads it
                    # to build server/.env, which docker compose loads as-is.
                    f.write(f"{key}={_quote(value)}\n")  # codeql[py/clear-text-storage-sensitive-data]
            os.replace(tmp_path, SECRETS_FILE)
        except BaseException:
            os.unlink(tmp_path)
            raise


def run_command(
    cmd: list[str],
    cwd: Path | None = None,
    capture: bool = False,
    env: dict | None = None,
    timeout: float | None = None,
) -> subprocess.CompletedProcess | None:
    """Run a command and handle errors.

    Returns None if the command is missing, interrupted, or (when `timeout` is
    set) doesn't finish in time.
    """
    full_env = {**os.environ, **(env or {})}
    try:
        if capture:
            return subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                env=full_env,
                timeout=timeout,
            )
        else:
            return subprocess.run(cmd, cwd=cwd, env=full_env, timeout=timeout)
    except FileNotFoundError:
        return None
    except subprocess.TimeoutExpired:
        return None
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted[/yellow]")
        return None


def check_command_exists(cmd: str) -> bool:
    """Check if a command exists in PATH."""
    return shutil.which(cmd) is not None


def is_docker_running() -> bool:
    """Check if the Docker daemon is reachable.

    Uses a timeout so a wedged daemon (socket present but unresponsive) fails
    fast instead of hanging the CLI.
    """
    result = run_command(["docker", "info"], capture=True, timeout=10)
    return result is not None and result.returncode == 0


def get_command_version(cmd: str, version_flag: str = "--version") -> str | None:
    """Get the version of a command."""
    result = run_command([cmd, version_flag], capture=True)
    if result and result.returncode == 0:
        return result.stdout.strip().split("\n")[0]
    return None


def is_port_in_use(port: int) -> bool:
    """Check if a port is in use."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) == 0


def find_available_port(start_port: int, max_attempts: int = 100) -> int:
    """Find an available port starting from start_port."""
    for offset in range(max_attempts):
        port = start_port + offset
        if not is_port_in_use(port):
            return port
    raise RuntimeError(f"Could not find available port starting from {start_port}")


def step_spinner(message: str):
    """Return a Rich Live spinner with consistent indentation matching step_status."""
    spinner = Spinner("dots", text=Text(f" {message}", style="bold"))
    return Live(
        Padding(spinner, (0, 0, 0, 2)),
        console=console,
        refresh_per_second=12,
        transient=True,
    )


def step_status(success: bool, message: str, detail: str = "") -> None:
    """Print a step status line."""
    icon = "[green]✓[/green]" if success else "[red]✗[/red]"
    if detail:
        console.print(f"  {icon} {message}  [dim]{detail}[/dim]")
    else:
        console.print(f"  {icon} {message}")


def check_env_file_exists(path: Path) -> bool:
    """Check if an environment file exists."""
    return path.exists()


def check_venv_exists() -> bool:
    """Check if Python virtual environment exists."""
    return (SERVER_DIR / ".venv").exists()


def check_node_modules_exists() -> bool:
    """Check if node_modules exists."""
    return (CLIENTS_DIR / "node_modules").exists()


def check_email_binary_exists() -> bool:
    """Check if email binary exists."""
    return (SERVER_DIR / "emails" / "node_modules").exists()
