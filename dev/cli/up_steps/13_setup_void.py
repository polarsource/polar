"""Configure optional Void development services."""

from shared import Context, step_status
from void_local import setup

NAME = "Setting up Void"


def run(ctx: Context) -> bool:
    if not ctx.void:
        step_status(True, "Void", "skipped (enable with --void)")
        return True
    return setup()
