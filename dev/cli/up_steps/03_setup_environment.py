"""Generate environment files."""

from shared import (
    Context,
    CLIENTS_DIR,
    ROOT_DIR,
    SERVER_DIR,
    check_env_file_exists,
    run_command,
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
    result = run_command([str(setup_script)], capture=False)

    if result and result.returncode == 0:
        step_status(True, "Environment files", "generated")
        return True
    else:
        step_status(False, "Environment files", "generation failed")
        return False
