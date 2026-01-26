"""Check and install required tools."""

import platform
import time

from shared import (
    Context,
    check_command_exists,
    console,
    get_command_version,
    run_command,
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
            with console.status("[bold]Waiting for Docker to start...[/bold]"):
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


def install_pnpm() -> bool:
    """Install pnpm using corepack or npm."""
    # Try corepack first
    if check_command_exists("corepack"):
        result = run_command(["corepack", "enable"], capture=True)
        if result and result.returncode == 0:
            result = run_command(["corepack", "prepare", "pnpm@latest", "--activate"], capture=True)
            if result and result.returncode == 0:
                return True

    # Try npm
    if check_command_exists("npm"):
        result = run_command(["npm", "install", "-g", "pnpm"], capture=True)
        if result and result.returncode == 0:
            return True

    # Try Homebrew on macOS
    if platform.system() == "Darwin" and check_command_exists("brew"):
        result = run_command(["brew", "install", "pnpm"], capture=True)
        return result is not None and result.returncode == 0

    return False


def run(ctx: Context) -> bool:
    """Check and install prerequisites: Docker, uv, pnpm, Node.js."""
    prereqs_ok = True
    system = platform.system()

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

    # pnpm
    if check_command_exists("pnpm"):
        version = get_command_version("pnpm")
        step_status(True, "pnpm", version or "")
    else:
        console.print("  [yellow]pnpm not found, installing...[/yellow]")
        if install_pnpm():
            version = get_command_version("pnpm")
            step_status(True, "pnpm", f"installed ({version})" if version else "installed")
        else:
            step_status(False, "pnpm", "installation failed - install manually: npm install -g pnpm")
            prereqs_ok = False

    # Node.js - just report status, step 02 handles installation via nvm
    if check_command_exists("node"):
        version = get_command_version("node")
        step_status(True, "Node.js", version or "")
    else:
        step_status(True, "Node.js", "not found (will install via nvm)")

    return prereqs_ok
