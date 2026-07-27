"""Switch git branch with a clean web dev-server restart."""

import os
import shutil
import time
from typing import Annotated

import typer

from shared import (
    CLIENTS_DIR,
    DEFAULT_WEB_PORT,
    ROOT_DIR,
    console,
    is_port_in_use,
    run_command,
)

WEB_DIR = CLIENTS_DIR / "apps" / "web"


def _find_web_pane() -> str | None:
    """Return the tmux pane id tagged as the web pane by `dev start`.

    Matching on the working directory is unreliable: the stripe pane is also
    created in the web dir, and any pane's path follows its foreground process.
    """
    result = run_command(
        ["tmux", "list-panes", "-a", "-F", "#{pane_id} #{@polar_role}"],
        capture=True,
    )
    if not result or result.returncode != 0:
        return None

    for line in result.stdout.strip().splitlines():
        pane_id, _, role = line.partition(" ")
        if role == "web":
            return pane_id
    return None


def _wait_port_free(port: int, timeout: float = 10.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not is_port_in_use(port):
            return True
        time.sleep(0.5)
    return False


def _kill_port(port: int) -> None:
    result = run_command(
        ["lsof", "-nP", f"-tiTCP:{port}", "-sTCP:LISTEN"], capture=True
    )
    if result and result.returncode == 0 and result.stdout.strip():
        run_command(["kill", "-9", *result.stdout.split()])


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def switch(
        branch: Annotated[str, typer.Argument(help="Branch to switch to")],
        create: Annotated[
            bool,
            typer.Option("--create", "-b", help="Create the branch (git checkout -b)"),
        ] = False,
        install: Annotated[
            bool,
            typer.Option(
                "--install",
                "-i",
                help="Reinstall JS deps, skipping package prebuilds "
                "(fast, but reuses existing dist — stale if a package changed)",
            ),
        ] = False,
    ) -> None:
        """
        Switch branch with a clean web restart.

        Stops the web dev server first so file watchers don't storm on the
        branch write-burst, checks out the branch, wipes the Turbopack cache,
        then relaunches web in its tmux pane.
        """
        dev_bin = str(ROOT_DIR / "dev" / "cli" / "dev")
        web_pane = _find_web_pane()
        if web_pane is None:
            console.print(
                "[red]No web pane found.[/red] Start the stack with "
                "[cyan]dev start[/cyan] so the web pane gets tagged."
            )
            raise typer.Exit(1)

        # From the web pane itself, relaunch in place (exec) — web is already
        # stopped (you had to interrupt it to type this). From any other pane,
        # drive the web pane remotely via send-keys.
        exec_here = os.environ.get("TMUX_PANE") == web_pane

        def relaunch() -> None:
            console.print("[blue]Relaunching web[/blue]")
            if exec_here:
                os.execvp(dev_bin, [dev_bin, "web"])
            run_command(["tmux", "send-keys", "-t", web_pane, f"{dev_bin} web", "C-m"])
            run_command(["tmux", "select-window", "-t", web_pane])
            run_command(["tmux", "select-pane", "-t", web_pane])

        if not exec_here:
            console.print(f"[blue]Stopping web[/blue] [dim](pane {web_pane})[/dim]")
            run_command(["tmux", "send-keys", "-t", web_pane, "C-c"])

        if not _wait_port_free(DEFAULT_WEB_PORT):
            console.print(
                f"[yellow]Port {DEFAULT_WEB_PORT} still held, killing listeners[/yellow]"
            )
            _kill_port(DEFAULT_WEB_PORT)
            _wait_port_free(DEFAULT_WEB_PORT, timeout=3.0)

        checkout = ["git", "checkout", *(["-b"] if create else []), branch]
        console.print(
            f"[blue]{'Creating' if create else 'Switching to'}[/blue] [bold]{branch}[/bold]"
        )
        result = run_command(checkout, cwd=ROOT_DIR)
        if not result or result.returncode != 0:
            console.print("[red]Checkout failed[/red]")
            relaunch()
            raise typer.Exit(1)

        if install:
            console.print(
                "[blue]Installing JS deps[/blue] [dim](--ignore-scripts)[/dim]"
            )
            run_command(
                ["pnpm", "install", "--ignore-scripts"], cwd=CLIENTS_DIR
            )

        console.print("[blue]Wiping Turbopack cache[/blue] [dim](.next)[/dim]")
        shutil.rmtree(WEB_DIR / ".next", ignore_errors=True)

        relaunch()
