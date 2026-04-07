"""Start all services in a tmux session."""

import os
import shutil
from pathlib import Path

import typer

from shared import CLIENTS_DIR, ROOT_DIR, SERVER_DIR, console, run_command, step_spinner

SESSION = "polar"
TMUX_CONF = Path.home() / ".tmux.conf"


def _is_tmux_installed() -> bool:
    return shutil.which("tmux") is not None


def _session_exists() -> bool:
    result = run_command(["tmux", "has-session", "-t", SESSION], capture=True)
    return result is not None and result.returncode == 0


def _has_mouse_support() -> bool:
    """Check if tmux mouse support is already enabled."""
    if not TMUX_CONF.exists():
        return False
    content = TMUX_CONF.read_text()
    for line in content.splitlines():
        stripped = line.strip()
        if stripped == "set -g mouse on" or stripped == "set-option -g mouse on":
            return True
    return False


def _ensure_mouse_support() -> None:
    """Prompt to enable mouse scrolling in tmux if not configured."""
    if _has_mouse_support():
        return

    console.print("  [dim]Mouse scrolling is not enabled in tmux. Enabling it lets you[/dim]")
    console.print("  [dim]scroll logs and click between panes with your mouse.[/dim]")
    if typer.confirm("  Enable mouse support in ~/.tmux.conf?", default=True):
        if TMUX_CONF.exists():
            content = TMUX_CONF.read_text()
            if not content.endswith("\n"):
                content += "\n"
            content += "set -g mouse on\n"
        else:
            content = "set -g mouse on\n"
        TMUX_CONF.write_text(content)
        console.print("  [green]✓[/green] Mouse support enabled\n")
    else:
        console.print("  [dim]Tip: Ctrl-b then [ to scroll, q to exit scroll mode[/dim]\n")


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def start() -> None:
        """Start all services (api, worker, web, stripe) in a tmux session."""
        if not prompt_setup():
            raise typer.Exit(1)

        if not _is_tmux_installed():
            if typer.confirm("tmux is required but not installed. Install via Homebrew now?", default=True):
                with step_spinner("Installing tmux..."):
                    result = run_command(["brew", "install", "tmux"], capture=True)
                if not result or result.returncode != 0 or not _is_tmux_installed():
                    console.print("[red]Installation failed. Install manually: brew install tmux[/red]")
                    raise typer.Exit(1)
            else:
                console.print("[yellow]tmux is required. Install it with: brew install tmux[/yellow]")
                raise typer.Exit(1)

        _ensure_mouse_support()

        if _session_exists():
            console.print(f"[bold blue]Attaching to existing '{SESSION}' session[/bold blue]\n")
            os.execvp("tmux", ["tmux", "attach-session", "-t", SESSION])

        console.print(f"[bold blue]Starting Polar in tmux session '{SESSION}'[/bold blue]\n")

        dev_bin = str(ROOT_DIR / "dev" / "cli" / "dev")
        server_dir = str(SERVER_DIR)
        web_dir = str(CLIENTS_DIR / "apps" / "web")
        root_dir = str(ROOT_DIR)

        svc = f"{SESSION}:services"
        commands = [
            # Create session with first window
            ["tmux", "new-session", "-d", "-s", SESSION, "-n", "services", "-c", root_dir],

            # Split into 4 panes
            ["tmux", "send-keys", "-t", f"{svc}.0", f"cd {server_dir}", "C-m"],
            ["tmux", "split-window", "-h", "-t", svc, "-c", server_dir],
            ["tmux", "split-window", "-v", "-t", f"{svc}.0", "-c", server_dir],
            ["tmux", "split-window", "-v", "-t", f"{svc}.2", "-c", web_dir],
            ["tmux", "select-layout", "-t", svc, "tiled"],

            # Start services in each pane
            ["tmux", "send-keys", "-t", f"{svc}.0", f"{dev_bin} api", "C-m"],
            ["tmux", "send-keys", "-t", f"{svc}.1", f"{dev_bin} worker", "C-m"],
            ["tmux", "send-keys", "-t", f"{svc}.2", f"{dev_bin} web", "C-m"],
            ["tmux", "send-keys", "-t", f"{svc}.3", f"{dev_bin} stripe --listen", "C-m"],

            # Create second window for general use
            ["tmux", "new-window", "-t", SESSION, "-n", "dev", "-c", root_dir],

            # Select the services window
            ["tmux", "select-window", "-t", svc],
        ]

        for cmd in commands:
            result = run_command(cmd, capture=True)
            if result is None or result.returncode != 0:
                console.print(f"[red]Failed to run: {' '.join(cmd)}[/red]")
                # Try to clean up
                run_command(["tmux", "kill-session", "-t", SESSION], capture=True)
                raise typer.Exit(1)

        # Attach to the session
        os.execvp("tmux", ["tmux", "attach-session", "-t", SESSION])
