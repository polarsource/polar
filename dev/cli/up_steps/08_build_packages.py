"""Build shared packages (ui, client, checkout, customer-portal)."""

from shared import (
    Context,
    CLIENTS_DIR,
    console,
    run_command,
    step_status,
)

NAME = "Building packages"


def run(ctx: Context) -> bool:
    """Build shared packages that the web app depends on."""
    with console.status("[bold]Building packages (ui, client, checkout, customer-portal)...[/bold]"):
        result = run_command(
            ["pnpm", "turbo", "run", "build", "--filter=./packages/*"],
            cwd=CLIENTS_DIR,
            capture=True,
        )
        if result and result.returncode == 0:
            step_status(True, "Packages built", "ui, client, checkout, customer-portal")
            return True
        else:
            step_status(False, "Package build", "failed")
            if result and result.stderr:
                console.print(f"[dim]{result.stderr[:500]}[/dim]")
            return False
