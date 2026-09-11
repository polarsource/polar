"""Set up the correct Node.js version via nvm."""

import os
import subprocess
from pathlib import Path

from shared import (
    ROOT_DIR,
    Context,
    console,
    ensure_pnpm,
    get_command_version,
    print_output_tail,
    run_command,
    step_spinner,
    step_status,
)

NAME = "Setting up Node version"

REQUIRED_NODE_MAJOR = 24


def is_nvm_installed() -> bool:
    """Check if nvm is installed."""
    nvm_dir = Path.home() / ".nvm"
    return nvm_dir.exists() and (nvm_dir / "nvm.sh").exists()


def _nvm_script() -> Path:
    """Return the path to nvm.sh."""
    return Path.home() / ".nvm" / "nvm.sh"


def _run_with_nvm(nvm_cmd: str, capture: bool = True) -> "subprocess.CompletedProcess | None":
    """Run a command inside a bash shell with nvm sourced."""

    cmd = f'source "{_nvm_script()}" --no-use && {nvm_cmd}'
    return run_command(
        ["bash", "-c", cmd],
        cwd=ROOT_DIR,
        capture=capture,
        env={"NVM_DIR": str(_nvm_script().parent)},
    )


def install_nvm() -> bool:
    """Install nvm using the official install script."""
    result = run_command(
        ["bash", "-c", "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"],
        capture=True,
    )
    if result is None or result.returncode != 0:
        print_output_tail(result)
        return False
    return is_nvm_installed()


def run_nvm_install_node() -> bool:
    """Use nvm to install the correct Node version."""
    if not _nvm_script().exists():
        return False

    result = _run_with_nvm(f"nvm install {REQUIRED_NODE_MAJOR}")
    if result is None or result.returncode != 0:
        print_output_tail(result)
        return False
    return True


def activate_nvm_node() -> bool:
    """Activate nvm Node in the current process by updating PATH."""
    if not _nvm_script().exists():
        return False

    # Use the specific required version, not "current" which may not be set
    result = _run_with_nvm(f"nvm which {REQUIRED_NODE_MAJOR}")

    if result and result.returncode == 0 and result.stdout.strip():
        node_path = Path(result.stdout.strip())
        if node_path.exists():
            bin_dir = str(node_path.parent)
            current_path = os.environ.get("PATH", "")
            if bin_dir not in current_path:
                os.environ["PATH"] = f"{bin_dir}:{current_path}"
            return True
    return False


def run(ctx: Context) -> bool:
    """Ensure correct Node.js version is installed and active."""
    nvmrc_path = ROOT_DIR / ".nvmrc"

    # Create .nvmrc if it doesn't exist
    if not nvmrc_path.exists():
        nvmrc_path.write_text(f"{REQUIRED_NODE_MAJOR}\n")
        step_status(True, "Created .nvmrc", f"Node {REQUIRED_NODE_MAJOR}")
    else:
        step_status(True, ".nvmrc exists", nvmrc_path.read_text().strip())

    # Check current Node version
    current_node_version = get_command_version("node")
    current_node_major = None
    if current_node_version:
        try:
            current_node_major = int(current_node_version.lstrip("v").split(".")[0])
        except ValueError:
            pass

    if current_node_major == REQUIRED_NODE_MAJOR:
        step_status(True, "Node version", f"v{current_node_major} (matches required)")
        return ensure_pnpm()

    # Wrong or missing Node version
    if current_node_major:
        console.print(f"  [yellow]Node {current_node_major} found, but {REQUIRED_NODE_MAJOR} required[/yellow]")
    else:
        console.print(f"  [yellow]Node not found, installing {REQUIRED_NODE_MAJOR}...[/yellow]")

    # Install nvm if needed
    if not is_nvm_installed():
        with step_spinner("Installing nvm..."):
            if install_nvm():
                step_status(True, "nvm", "installed")
            else:
                step_status(False, "nvm", "installation failed")
                console.print("  [dim]Install manually: https://github.com/nvm-sh/nvm[/dim]")
                return False

    # Install correct Node version
    with step_spinner(f"Installing Node {REQUIRED_NODE_MAJOR} via nvm..."):
        if run_nvm_install_node():
            step_status(True, f"Node {REQUIRED_NODE_MAJOR}", "installed via nvm")
        else:
            step_status(False, f"Node {REQUIRED_NODE_MAJOR}", "installation failed")
            console.print(
                f"  [dim]Try manually: source ~/.nvm/nvm.sh && nvm install {REQUIRED_NODE_MAJOR},"
                " then run dev up again[/dim]"
            )
            return False

    # Activate nvm Node
    if activate_nvm_node():
        step_status(True, "Node activated", "added to PATH for this session")
    else:
        console.print("[yellow]Could not activate Node automatically.[/yellow]")
        console.print("Run: [bold]source ~/.nvm/nvm.sh && nvm use[/bold]")
        console.print("Then run [bold]dev up[/bold] again.")
        return False

    return ensure_pnpm()
