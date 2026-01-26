"""Build email templates."""

from shared import (
    Context,
    SERVER_DIR,
    check_email_binary_exists,
    console,
    run_command,
    step_status,
)

NAME = "Building email templates"


def run(ctx: Context) -> bool:
    """Build email templates."""
    if check_email_binary_exists() and not ctx.clean:
        step_status(True, "Email templates", "already built")
        return True

    with console.status("[bold]Building emails...[/bold]"):
        result = run_command(
            ["uv", "run", "task", "emails"], cwd=SERVER_DIR, capture=True
        )
        if result and result.returncode == 0:
            step_status(True, "Email templates", "built")
            return True
        else:
            step_status(False, "Email templates", "build failed (optional)")
            if result:
                console.print(f"[dim]{result.stderr}[/dim]")
            # Don't fail - emails are optional for basic dev
            return True
