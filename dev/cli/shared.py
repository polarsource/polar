"""Shared utilities and context for the Polar Development CLI."""

import json
import os
import shutil
import socket
import subprocess
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from rich.console import Console
from rich.live import Live
from rich.padding import Padding
from rich.spinner import Spinner
from rich.text import Text

from secrets_io import SECRETS_FILE, read_secrets, update_secrets

__all__ = ["SECRETS_FILE", "read_secrets", "update_secrets"]

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


@dataclass
class Context:
    """Shared context passed to each step."""

    clean: bool = False
    skip_integrations: bool = False
    database_name: str | None = None
    state: dict = field(default_factory=dict)


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


def step_failed(
    message: str,
    detail: str,
    result: subprocess.CompletedProcess | None = None,
    hints: tuple[str, ...] = (),
    lines: int = 30,
) -> None:
    """Report a failed step: status line, the command's output tail, then how to fix it."""
    step_status(False, message, detail)
    print_output_tail(result, lines)
    if hints:
        console.print("  [bold]To fix:[/bold]")
        for hint in hints:
            console.print(f"    • {hint}")


def print_output_tail(
    result: subprocess.CompletedProcess | None, lines: int = 30, max_line_length: int = 200
) -> None:
    """Print the last lines of a failed command's output, stdout and stderr combined."""
    if result is None:
        return
    output = "\n".join(part.strip() for part in (result.stdout, result.stderr) if part and part.strip())
    if not output:
        return
    tail = [
        line if len(line) <= max_line_length else line[: max_line_length - 1] + "…"
        for line in output.splitlines()[-lines:]
    ]
    console.print(Padding(Text("\n".join(tail), style="dim"), (0, 0, 0, 4)))


_BROKEN_CLT_MARKERS = (
    "tapi error",
    "unknown architecture",
    "linker command failed",
    "xcrun: error",
    "invalid active developer path",
    "does not contain",
)


def looks_like_broken_clt(output: str) -> bool:
    """Whether build output points at outdated or broken macOS Command Line Tools."""
    lowered = output.lower()
    return any(marker in lowered for marker in _BROKEN_CLT_MARKERS)


def check_clt_can_link() -> bool:
    """Compile and link a trivial program against a system framework.

    An outdated or half-updated Command Line Tools install passes `xcode-select -p`
    but fails here, the same way native Python extensions fail later in `uv sync`.
    """
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / "clt_check.c"
        source.write_text("int main(void) { return 0; }\n")
        result = run_command(
            ["cc", "-framework", "CoreFoundation", "-o", str(Path(tmp) / "clt_check"), str(source)],
            capture=True,
            timeout=60,
        )
    return result is not None and result.returncode == 0


def print_clt_repair_hint() -> None:
    """Explain how to fix Command Line Tools that can't build native code."""
    console.print(
        "  [yellow]The macOS Command Line Tools can't build native code."
        " This happens when they are outdated or only partially updated.[/yellow]"
    )
    console.print("  Fix them, then run [bold]dev up[/bold] again:")
    console.print(
        "    1. System Settings → General → Software Update:"
        " install the [bold]Command Line Tools for Xcode[/bold] update if one is offered"
    )
    console.print(
        '       (or: [bold]softwareupdate --list[/bold], then [bold]softwareupdate --install "<label>"[/bold])'
    )
    console.print(
        "    2. If no update is offered, reinstall them:"
        " [bold]sudo rm -rf /Library/Developer/CommandLineTools && xcode-select --install[/bold]"
    )


def required_pnpm_version() -> str | None:
    """The pnpm version pinned in clients/package.json, if any."""
    try:
        manager = json.loads((CLIENTS_DIR / "package.json").read_text()).get("packageManager", "")
    except (OSError, ValueError):
        return None
    return manager.removeprefix("pnpm@") if manager.startswith("pnpm@") else None


def install_pnpm() -> subprocess.CompletedProcess | None:
    """Install the pinned pnpm via corepack, falling back to npm."""
    spec = f"pnpm@{required_pnpm_version() or 'latest'}"
    result = run_command(["corepack", "enable"], capture=True)
    if result and result.returncode == 0:
        result = run_command(["corepack", "prepare", spec, "--activate"], capture=True)
        if result and result.returncode == 0:
            return result
    return run_command(["npm", "install", "-g", spec], capture=True)


def ensure_pnpm() -> bool:
    """Make sure pnpm is available, installing it when Node is present but pnpm is not."""
    if check_command_exists("pnpm"):
        step_status(True, "pnpm", get_command_version("pnpm") or "installed")
        return True

    console.print("  [yellow]pnpm not found, installing...[/yellow]")
    result = install_pnpm()
    if result is not None and result.returncode == 0 and check_command_exists("pnpm"):
        step_status(True, "pnpm", f"installed ({get_command_version('pnpm') or ''})".replace(" ()", ""))
        return True

    step_status(False, "pnpm", "installation failed")
    print_output_tail(result)
    console.print(
        f"  [dim]Install manually: npm install -g pnpm@{required_pnpm_version() or 'latest'},"
        " then run dev up again[/dim]"
    )
    return False


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
