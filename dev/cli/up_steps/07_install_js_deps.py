"""Install JavaScript dependencies using pnpm."""

import re

from shared import (
    CLIENTS_DIR,
    Context,
    ensure_pnpm,
    print_output_tail,
    run_command,
    step_spinner,
    step_status,
    working_pnpm_version,
)

NAME = "Installing JavaScript dependencies"

PNPM_ERROR_CODE = re.compile(r"ERR_PNPM_[A-Z0-9_]+")


def run(ctx: Context) -> bool:
    """Run pnpm install to install JS dependencies."""
    if working_pnpm_version() is None and not ensure_pnpm():
        ctx.failure_reason = "pnpm_unavailable"
        return False

    with step_spinner("Running pnpm install..."):
        result = run_command(["pnpm", "install"], cwd=CLIENTS_DIR, capture=True)
    if result and result.returncode == 0:
        step_status(True, "pnpm install", "complete")
        return True

    code = PNPM_ERROR_CODE.search(f"{result.stdout}\n{result.stderr}" if result else "")
    ctx.failure_reason = code.group(0) if code else None
    step_status(False, "pnpm install", "failed")
    print_output_tail(result, lines=40)
    return False
