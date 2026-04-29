"""Copy the Acceptable Use Policy file from the web app to the server."""

from shared import (
    SERVER_DIR,
    Context,
    console,
    run_command,
    step_spinner,
    step_status,
)

NAME = "Copying acceptable use policy"

AUP_PATH = (
    SERVER_DIR / "polar" / "organization_review" / "acceptable-use-policy.mdx"
)


def run(ctx: Context) -> bool:
    """Copy the AUP file used by the organization review agent."""
    if AUP_PATH.exists() and not ctx.clean:
        step_status(True, "Acceptable use policy", "already copied")
        return True

    with step_spinner("Copying acceptable use policy..."):
        result = run_command(
            ["uv", "run", "-m", "polar.organization_review.policy"],
            cwd=SERVER_DIR,
            capture=True,
        )
        if result and result.returncode == 0:
            step_status(True, "Acceptable use policy", "copied")
            return True
        else:
            step_status(False, "Acceptable use policy", "copy failed")
            if result and result.stderr:
                console.print(f"[dim]{result.stderr[:500]}[/dim]")
            return False
