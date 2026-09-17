"""Check and install required tools."""

import platform
import re
import time
from pathlib import Path

from shared import (
    Context,
    check_clt_can_link,
    check_command_exists,
    console,
    get_command_version,
    is_docker_running,
    print_clt_repair_hint,
    run_command,
    step_failed,
    step_spinner,
    step_status,
)

NAME = "Checking prerequisites"


def install_docker() -> bool:
    """Install Docker using Homebrew (macOS only)."""
    if platform.system() != "Darwin":
        console.print("  [dim]Automatic Docker install only supported on macOS[/dim]")
        console.print("  [dim]Please install Docker manually: https://docs.docker.com/get-docker/[/dim]")
        return False

    if not check_command_exists("brew"):
        console.print("  [dim]Homebrew not found. Install it first: https://brew.sh[/dim]")
        return False

    console.print("  [dim]Installing Docker via Homebrew...[/dim]")
    result = run_command(["brew", "install", "--cask", "docker"], capture=False)
    return result is not None and result.returncode == 0


def start_docker() -> bool:
    """Attempt to start Docker Desktop (macOS)."""
    if platform.system() == "Darwin":
        result = run_command(["open", "-a", "Docker"], capture=True)
        if result and result.returncode == 0:
            with step_spinner("Waiting for Docker to start..."):
                for _ in range(60):
                    time.sleep(2)
                    if is_docker_running():
                        return True
            return False
    elif platform.system() == "Linux":
        result = run_command(["sudo", "systemctl", "start", "docker"], capture=True)
        if result and result.returncode == 0:
            time.sleep(2)
            return is_docker_running()
    return False


def install_homebrew() -> bool:
    """Install Homebrew on macOS."""
    if platform.system() != "Darwin":
        return False

    console.print("  [dim]Installing Homebrew...[/dim]")
    result = run_command(
        ["bash", "-c", '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'],
        capture=False,
    )
    return result is not None and result.returncode == 0



def is_xcode_clt_installed() -> bool:
    """Check if Xcode Command Line Tools are installed."""
    result = run_command(["xcode-select", "-p"], capture=True)
    return result is not None and result.returncode == 0


def install_xcode_clt() -> bool:
    """Install Xcode Command Line Tools."""
    console.print("  [dim]This may open a system dialog — click Install when prompted.[/dim]")
    result = run_command(["xcode-select", "--install"], capture=False)
    if result and result.returncode == 0:
        # Wait for installation to complete
        import time
        with step_spinner("Waiting for Xcode Command Line Tools to install..."):
            for _ in range(300):  # up to 5 minutes
                if is_xcode_clt_installed():
                    return True
                time.sleep(2)
    return False


_CLT_ON_DEMAND_FLAG = Path("/tmp/.com.apple.dt.CommandLineTools.installondemand.in-progress")
_CLT_LABEL = re.compile(r"\*\s*Label:\s*(Command Line Tools for Xcode[ \d.]*-([\d.]+))\s*$", re.MULTILINE)


def find_clt_update_label() -> str | None:
    """Ask softwareupdate for the newest Command Line Tools package.

    The flag file makes softwareupdate list Command Line Tools packages, the
    same trick Homebrew's installer uses to install them without the GUI.
    """
    try:
        _CLT_ON_DEMAND_FLAG.touch()
        result = run_command(["softwareupdate", "--list"], capture=True, timeout=300)
    finally:
        _CLT_ON_DEMAND_FLAG.unlink(missing_ok=True)
    if result is None or result.returncode != 0:
        return None
    matches = _CLT_LABEL.findall(result.stdout + result.stderr)
    if not matches:
        return None
    return max(matches, key=lambda match: tuple(int(n) for n in match[1].split(".")))[0]


def update_xcode_clt() -> bool:
    """Install the latest Command Line Tools through softwareupdate."""
    with step_spinner("Looking for a Command Line Tools update..."):
        label = find_clt_update_label()
    if label is None:
        return False
    console.print(f"  [dim]Installing '{label}' (this can take a while and may ask for your password)[/dim]")
    result = run_command(["sudo", "softwareupdate", "--install", label], capture=False, timeout=3600)
    return result is not None and result.returncode == 0 and check_clt_can_link()


def run(ctx: Context) -> bool:
    """Check and install prerequisites: Docker, uv, pnpm, Node.js."""
    prereqs_ok = True
    system = platform.system()

    # Xcode Command Line Tools (macOS) - required for git, compilers, etc.
    if system == "Darwin":
        if is_xcode_clt_installed():
            if check_clt_can_link():
                step_status(True, "Xcode CLT", "installed")
            else:
                console.print("  [yellow]Xcode Command Line Tools are installed but can't build native code, updating...[/yellow]")
                if update_xcode_clt():
                    step_status(True, "Xcode CLT", "updated")
                else:
                    step_status(False, "Xcode CLT", "update failed")
                    print_clt_repair_hint()
                    prereqs_ok = False
        else:
            console.print("  [yellow]Xcode Command Line Tools not found, installing...[/yellow]")
            if install_xcode_clt():
                step_status(True, "Xcode CLT", "installed")
            else:
                step_status(False, "Xcode CLT", "installation failed - run: xcode-select --install")
                prereqs_ok = False

    # Homebrew (macOS) - needed for installing other tools
    if system == "Darwin":
        if check_command_exists("brew"):
            step_status(True, "Homebrew", "installed")
        else:
            console.print("  [yellow]Homebrew not found, installing...[/yellow]")
            if install_homebrew():
                step_status(True, "Homebrew", "installed")
            else:
                step_status(False, "Homebrew", "installation failed - visit https://brew.sh")
                prereqs_ok = False

    # Docker
    if check_command_exists("docker"):
        if is_docker_running():
            step_status(True, "Docker", "running")
        else:
            console.print("  [yellow]Docker not running, starting...[/yellow]")
            if start_docker():
                step_status(True, "Docker", "started")
            else:
                step_status(False, "Docker", "failed to start - please start Docker manually")
                prereqs_ok = False
    else:
        console.print("  [yellow]Docker not found, installing...[/yellow]")
        if install_docker():
            step_status(True, "Docker", "installed")
            console.print("  [yellow]Starting Docker...[/yellow]")
            if start_docker():
                step_status(True, "Docker", "started")
            else:
                step_status(False, "Docker", "installed but failed to start - please start Docker manually")
                prereqs_ok = False
        else:
            step_status(False, "Docker", "installation failed")
            prereqs_ok = False

    # uv (already installed by bootstrap wrapper)
    version = get_command_version("uv")
    step_status(True, "uv", version or "")

    # pnpm - just report status, step 02 handles installation after Node is set up
    if check_command_exists("pnpm"):
        version = get_command_version("pnpm")
        step_status(True, "pnpm", version or "")
    else:
        step_status(True, "pnpm", "not found (will install after Node setup)")

    # Node.js - just report status, step 02 handles installation via nvm
    if check_command_exists("node"):
        version = get_command_version("node")
        step_status(True, "Node.js", version or "")
    else:
        step_status(True, "Node.js", "not found (will install via nvm)")

    # Tinybird CLI - required by backend tests
    if check_command_exists("tb"):
        step_status(True, "Tinybird CLI", "installed")
    else:
        console.print("  [yellow]Tinybird CLI not found, installing...[/yellow]")
        with step_spinner("Installing Tinybird CLI..."):
            result = run_command(
                ["bash", "-c", "curl -sSL https://tinybird.co/install.sh | bash"],
                capture=True,
            )
        if result and result.returncode == 0:
            if check_command_exists("tb"):
                step_status(True, "Tinybird CLI", "installed")
            else:
                # The install script puts tb in ~/.local/bin which may not be in PATH
                console.print(
                    "  [dim]tb not found in PATH, running uv tool update-shell"
                    " to add ~/.local/bin to your shell profile...[/dim]"
                )
                run_command(["uv", "tool", "update-shell"], capture=True)
                step_status(True, "Tinybird CLI", "installed (restart your shell to pick up PATH changes)")
        else:
            step_failed(
                "Tinybird CLI",
                "installation failed",
                result,
                hints=("Install it manually: [bold]curl -sSL https://tinybird.co/install.sh | bash[/bold]",),
            )
            prereqs_ok = False

    return prereqs_ok
