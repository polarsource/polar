"""Check and install required tools."""

import platform
import time

from shared import (
    Context,
    check_command_exists,
    console,
    get_command_version,
    run_command,
    step_spinner,
    step_status,
)

NAME = "Checking prerequisites"


def is_docker_running() -> bool:
    """Check if Docker daemon is running."""
    result = run_command(["docker", "info"], capture=True)
    return result is not None and result.returncode == 0


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


def run(ctx: Context) -> bool:
    """Check and install prerequisites: Docker, uv, pnpm, Node.js."""
    prereqs_ok = True
    system = platform.system()

    # Xcode Command Line Tools (macOS) - required for git, compilers, etc.
    if system == "Darwin":
        if is_xcode_clt_installed():
            step_status(True, "Xcode CLT", "installed")
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
            step_status(False, "Tinybird CLI", "installation failed")
            if result:
                console.print(f"[dim]{result.stderr}[/dim]")
            prereqs_ok = False

    return prereqs_ok
