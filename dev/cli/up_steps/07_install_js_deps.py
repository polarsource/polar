"""Install JavaScript dependencies using pnpm."""

from shared import (
    CLIENTS_DIR,
    Context,
    console,
    run_command,
    step_spinner,
    step_status,
)

NAME = "Installing JavaScript dependencies"


def run(ctx: Context) -> bool:
    """Run pnpm install to install JS dependencies."""
    with step_spinner("Running pnpm install..."):
        result = run_command(["pnpm", "install"], cwd=CLIENTS_DIR, capture=True)
        if result and result.returncode == 0:
            step_status(True, "pnpm install", "complete")
            return True
        else:
            step_status(False, "pnpm install", "failed")
            if result:
                output = result.stderr or result.stdout
                if output:
                    console.print(f"[dim]{output}[/dim]")
            return False
