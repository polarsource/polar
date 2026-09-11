"""Install JavaScript dependencies using pnpm."""

from shared import (
    CLIENTS_DIR,
    Context,
    check_command_exists,
    ensure_pnpm,
    print_output_tail,
    run_command,
    step_spinner,
    step_status,
)

NAME = "Installing JavaScript dependencies"


def run(ctx: Context) -> bool:
    """Run pnpm install to install JS dependencies."""
    if not check_command_exists("pnpm") and not ensure_pnpm():
        return False

    with step_spinner("Running pnpm install..."):
        result = run_command(["pnpm", "install"], cwd=CLIENTS_DIR, capture=True)
    if result and result.returncode == 0:
        step_status(True, "pnpm install", "complete")
        return True

    step_status(False, "pnpm install", "failed")
    print_output_tail(result, lines=40)
    return False
