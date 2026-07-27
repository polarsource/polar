"""Free the dev ports — kill whatever is listening on 3000 (web) and 8000 (API)."""

import os
import signal
import subprocess
import time
from typing import Annotated

import typer

from shared import (
    DEFAULT_API_PORT,
    DEFAULT_WEB_PORT,
    check_command_exists,
    console,
    is_port_in_use,
)


def _pids_on_port(port: int) -> list[int]:
    """PIDs listening on a TCP port (via lsof). Deduped (lsof lists IPv4 + IPv6)."""
    result = subprocess.run(
        ["lsof", "-ti", f"tcp:{port}"],
        capture_output=True,
        text=True,
    )
    return sorted({int(p) for p in result.stdout.split() if p.strip().isdigit()})


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command(name="kill-ports")
    def kill_ports(
        ports: Annotated[
            list[int] | None,
            typer.Argument(
                help="Ports to free (default: the dev web + API ports, 3000 and 8000)"
            ),
        ] = None,
    ) -> None:
        """Kill whatever is listening on the dev ports (3000 web, 8000 API).
        """
        if not check_command_exists("lsof"):
            console.print("[red]`lsof` not found — can't look up port owners.[/red]")
            raise typer.Exit(1)

        targets = ports or [DEFAULT_WEB_PORT, DEFAULT_API_PORT]
        console.print()
        for port in targets:
            pids = _pids_on_port(port)
            if not pids:
                console.print(f"[dim]:{port} already free[/dim]")
                continue
            for pid in pids:
                try:
                    os.kill(pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass

            deadline = time.monotonic() + 5
            while time.monotonic() < deadline and is_port_in_use(port):
                time.sleep(0.2)
            for pid in _pids_on_port(port):
                try:
                    os.kill(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
            killed = ", ".join(str(p) for p in pids)
            console.print(f"[green]:{port} freed[/green] [dim](killed {killed})[/dim]")
        console.print()
