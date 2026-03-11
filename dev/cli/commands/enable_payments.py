"""Enable payments for a local development organization."""

import typer

from shared import SERVER_DIR, run_command


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command("enable-payments")
    def enable_payments(
        slug: str = typer.Argument(..., help="Organization slug to enable payments for"),
    ) -> None:
        """Enable payments for an organization (dev only).

        Creates a fake Stripe account, verifies the admin user's identity,
        sets organization details, and marks the organization as ACTIVE.
        """
        result = run_command(
            ["uv", "run", "task", "enable_payments", slug],
            cwd=SERVER_DIR,
            capture=False,
        )
        if result and result.returncode != 0:
            raise typer.Exit(result.returncode)
