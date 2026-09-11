"""Build email templates."""

from shared import (
    SERVER_DIR,
    Context,
    check_email_binary_exists,
    run_command,
    step_failed,
    step_spinner,
    step_status,
)

NAME = "Building email templates"


def run(ctx: Context) -> bool:
    """Build email templates."""
    if check_email_binary_exists() and not ctx.clean:
        step_status(True, "Email templates", "already built")
        return True

    with step_spinner("Building emails..."):
        result = run_command(
            ["uv", "run", "task", "emails"], cwd=SERVER_DIR, capture=True
        )
        if result and result.returncode == 0:
            step_status(True, "Email templates", "built")
            return True
        else:
            step_failed(
                "Email templates",
                "build failed",
                result,
                hints=(
                    "The API and tests refuse to start without server/emails/bin/react-email-pkg, so this can't be skipped",
                    "Run [bold]uv run task emails[/bold] in server/ to retry with the full log",
                ),
                lines=40,
            )
            return False
