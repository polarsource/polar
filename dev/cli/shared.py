"""Shared utilities and context for the Polar Development CLI."""

import os
import shutil
import socket
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path

from rich.console import Console

console = Console()
ROOT_DIR = Path(__file__).parent.parent.parent.resolve()
SERVER_DIR = ROOT_DIR / "server"
CLIENTS_DIR = ROOT_DIR / "clients"
DEFAULT_API_PORT = 8000
DEFAULT_WEB_PORT = 3000
DEFAULT_DB_PORT = 5432
DEFAULT_REDIS_PORT = 6379
DEFAULT_MINIO_PORT = 9000
SECRETS_FILE = Path.home() / ".config" / "polar" / "secrets.env"


@dataclass
class Context:
    """Shared context passed to each step."""

    clean: bool = False
    skip_integrations: bool = False
    state: dict = field(default_factory=dict)


def run_command(
    cmd: list[str],
    cwd: Path | None = None,
    capture: bool = False,
    env: dict | None = None,
) -> subprocess.CompletedProcess | None:
    """Run a command and handle errors."""
    full_env = {**os.environ, **(env or {})}
    try:
        if capture:
            return subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                env=full_env,
            )
        else:
            return subprocess.run(cmd, cwd=cwd, env=full_env)
    except FileNotFoundError:
        return None
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted[/yellow]")
        return None


def check_command_exists(cmd: str) -> bool:
    """Check if a command exists in PATH."""
    return shutil.which(cmd) is not None


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
