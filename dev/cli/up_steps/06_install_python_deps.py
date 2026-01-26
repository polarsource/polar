"""Install Python dependencies using uv."""

from shared import (
    Context,
    SERVER_DIR,
    check_venv_exists,
    console,
    run_command,
    step_status,
)

NAME = "Installing Python dependencies"


def run(ctx: Context) -> bool:
    """Run uv sync to install Python dependencies."""
    if check_venv_exists() and not ctx.clean:
        step_status(True, "Python venv", "exists")
        return True

    with console.status("[bold]Running uv sync...[/bold]"):
        result = run_command(["uv", "sync"], cwd=SERVER_DIR, capture=True)
        if result and result.returncode == 0:
            step_status(True, "uv sync", "complete")
            return True
        else:
            step_status(False, "uv sync", "failed")
            if result:
                console.print(f"[dim]{result.stderr}[/dim]")
            return False
