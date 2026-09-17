"""Generate environment files."""

from shared import (
    CLIENTS_DIR,
    ROOT_DIR,
    SERVER_DIR,
    Context,
    check_env_file_exists,
    run_command,
    step_failed,
    step_status,
)

NAME = "Setting up environment files"


def run(ctx: Context) -> bool:
    """Generate .env files using setup-environment script."""
    server_env_exists = check_env_file_exists(SERVER_DIR / ".env")
    web_env_exists = check_env_file_exists(CLIENTS_DIR / "apps" / "web" / ".env.local")

    if server_env_exists and web_env_exists and not ctx.clean:
        step_status(True, "Environment files", "exist")
        return True

    setup_script = ROOT_DIR / "dev" / "setup-environment"
    command: list[str] = [str(setup_script)]
    if ctx.database_name:
        command.extend(["--database-name", ctx.database_name])
    result = run_command(command, capture=False)

    if result and result.returncode == 0:
        step_status(True, "Environment files", "generated")
        return True
    else:
        step_failed(
            "Environment files",
            "generation failed",
            hints=(
                "The error above comes from dev/setup-environment; run [bold]./dev/setup-environment[/bold] directly to retry",
                "Without server/.env the Docker containers can't start, so this must succeed before continuing",
            ),
        )
        return False
