"""Build the frontend application."""

import shutil

from shared import (
    Context,
    CLIENTS_DIR,
    console,
    run_command,
    step_status,
)

NAME = "Building frontend"


def run(ctx: Context) -> bool:
    """Clean .next folder and build frontend."""
    next_dir = CLIENTS_DIR / "apps" / "web" / ".next"

    if next_dir.exists():
        shutil.rmtree(next_dir)
        step_status(True, "Removed .next", "clean build")
    else:
        step_status(True, ".next folder", "already clean")

    with console.status("[bold]Running pnpm build...[/bold]"):
        result = run_command(["pnpm", "run", "build"], cwd=CLIENTS_DIR, capture=True)
        if result and result.returncode == 0:
            step_status(True, "pnpm build", "complete")
            return True
        else:
            step_status(False, "pnpm build", "failed")
            if result:
                console.print(f"[dim]{result.stderr[:500]}[/dim]")
            return False
