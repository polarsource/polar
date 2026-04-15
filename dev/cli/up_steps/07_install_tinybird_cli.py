"""Install the Tinybird CLI binary."""

from shared import (
    Context,
    check_command_exists,
    console,
    run_command,
    step_spinner,
    step_status,
)

NAME = "Installing Tinybird CLI"


def run(ctx: Context) -> bool:
    """Install the Tinybird CLI if not already present."""
    if check_command_exists("tb"):
        step_status(True, "Tinybird CLI", "already installed")
        return True

    with step_spinner("Installing Tinybird CLI..."):
        result = run_command(
            ["bash", "-c", "curl -sSL https://tinybird.co/install.sh | bash"],
            capture=True,
        )
        if result and result.returncode == 0:
            if check_command_exists("tb"):
                step_status(True, "Tinybird CLI", "installed")
                return True

            # The install script puts tb in ~/.local/bin which may not be in PATH
            console.print(
                "  [dim]tb not found in PATH, running uv tool update-shell"
                " to add ~/.local/bin to your shell profile...[/dim]"
            )
            run_command(["uv", "tool", "update-shell"], capture=True)
            step_status(True, "Tinybird CLI", "installed (restart your shell to pick up PATH changes)")
            return True
        else:
            step_status(False, "Tinybird CLI", "installation failed")
            if result:
                console.print(f"[dim]{result.stderr}[/dim]")
            return False
