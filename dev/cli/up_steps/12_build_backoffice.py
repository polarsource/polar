"""Build backoffice CSS and JS assets."""

from shared import (
    Context,
    SERVER_DIR,
    console,
    run_command,
    step_status,
)

NAME = "Building backoffice assets"

BACKOFFICE_DIR = SERVER_DIR / "polar" / "backoffice"


def check_backoffice_built() -> bool:
    """Check if backoffice assets are already built."""
    return (
        (BACKOFFICE_DIR / "static" / "styles.css").exists()
        and (BACKOFFICE_DIR / "static" / "scripts.js").exists()
    )


def run(ctx: Context) -> bool:
    """Build backoffice CSS and JS assets."""
    if check_backoffice_built() and not ctx.clean:
        step_status(True, "Backoffice assets", "already built")
        return True

    with console.status("[bold]Building backoffice assets...[/bold]"):
        result = run_command(
            ["uv", "run", "task", "backoffice"], cwd=SERVER_DIR, capture=True
        )
        if result and result.returncode == 0:
            step_status(True, "Backoffice assets", "built")
            return True
        else:
            step_status(False, "Backoffice assets", "build failed")
            if result and result.stderr:
                console.print(f"[dim]{result.stderr[:500]}[/dim]")
            return False
