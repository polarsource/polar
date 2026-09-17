"""Build shared packages (ui, client, checkout, customer-portal)."""

from shared import (
    CLIENTS_DIR,
    Context,
    run_command,
    step_failed,
    step_spinner,
    step_status,
)

NAME = "Building packages"


def run(ctx: Context) -> bool:
    """Build shared packages that the web app depends on."""
    with step_spinner("Building packages (ui, client, checkout, customer-portal)..."):
        result = run_command(
            ["pnpm", "turbo", "run", "build", "--filter=./packages/*"],
            cwd=CLIENTS_DIR,
            capture=True,
        )
        if result and result.returncode == 0:
            step_status(True, "Packages built", "ui, client, checkout, customer-portal")
            return True
        else:
            step_failed(
                "Package build",
                "failed",
                result,
                hints=(
                    "Run [bold]pnpm turbo run build --filter=./packages/*[/bold] in clients/ to see the full log",
                    "If the error mentions a missing module, run [bold]pnpm install[/bold] in clients/ first",
                ),
                lines=40,
            )
            return False
