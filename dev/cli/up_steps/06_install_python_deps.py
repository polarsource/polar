"""Install Python dependencies using uv."""

from shared import (
    SERVER_DIR,
    Context,
    console,
    run_command,
    step_spinner,
    step_status,
)

NAME = "Installing Python dependencies"


def run(ctx: Context) -> bool:
    """Run uv sync to install Python dependencies."""
    with step_spinner("Running uv sync..."):
        result = run_command(["uv", "sync"], cwd=SERVER_DIR, capture=True)
        if result and result.returncode == 0:
            step_status(True, "uv sync", "complete")
            return True
        else:
            step_status(False, "uv sync", "failed")
            if result:
                console.print(f"[dim]{result.stderr}[/dim]")
            return False
