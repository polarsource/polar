"""Honk a teammate over Tailscale, and manage your own honk listener."""

import json
import os
import platform
import plistlib
import shutil
import socket
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import typer

from shared import console

HONK_PORT = 45645
HONK_MESSAGE = b"HONK 1\n"
PLIST_LABEL = "sh.polar.honk"
PLIST_PATH = Path.home() / "Library" / "LaunchAgents" / f"{PLIST_LABEL}.plist"
LOG_PATH = Path.home() / ".config" / "polar" / "honk.log"
DAEMON_PATH = Path(__file__).resolve().parent.parent / "honk_daemon.py"

TAILSCALE_CANDIDATES = (
    "/opt/homebrew/bin/tailscale",
    "/usr/local/bin/tailscale",
    "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
)
# launchd agents start with a bare PATH; widen it so the daemon can find
# Tailscale (Homebrew or App Store) and the macOS sound tools.
DAEMON_PATH_ENV = "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"


def _tailscale_bin() -> str | None:
    found = shutil.which("tailscale")
    if found:
        return found
    return next((c for c in TAILSCALE_CANDIDATES if Path(c).exists()), None)


def _tailscale_status() -> dict | None:
    ts = _tailscale_bin()
    if not ts:
        return None
    try:
        result = subprocess.run(
            [ts, "status", "--json"], capture_output=True, text=True, timeout=10
        )
    except (subprocess.SubprocessError, OSError):
        return None
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def _short_name(login: str) -> str:
    """Email local part of a Tailscale login: 'sebastian@polar.sh' -> 'sebastian'."""
    return login.split("@", 1)[0] if "@" in login else login


def _peers(status: dict) -> list[dict]:
    """Every tailnet machine (peers and self) with its owner and IPv4 address."""
    users = status.get("User") or {}

    def entry(node: dict, is_self: bool) -> dict | None:
        ipv4 = next(
            (ip for ip in node.get("TailscaleIPs") or [] if ":" not in ip), None
        )
        if not ipv4:
            return None
        user = users.get(str(node.get("UserID"))) or {}
        login = user.get("LoginName") or ""
        display = user.get("DisplayName") or ""
        return {
            "host": node.get("HostName") or "?",
            "ip": ipv4,
            "person": _short_name(login) or display or "?",
            "login": login,
            "display": display,
            "online": bool(node.get("Online")),
            "is_self": is_self,
        }

    machines = []
    self_node = status.get("Self")
    if self_node and (e := entry(self_node, True)):
        machines.append(e)
    for node in (status.get("Peer") or {}).values():
        if e := entry(node, False):
            machines.append(e)
    return machines


def _match(peers: list[dict], query: str) -> list[dict]:
    needle = query.lower()
    matches = []
    for peer in peers:
        fields = (
            peer["person"].lower(),
            peer["host"].lower(),
            peer["login"].lower(),
            peer["display"].lower(),
        )
        if any(needle in field for field in fields):
            matches.append(peer)
    return matches


def _send_honk(ip: str) -> bool:
    try:
        with socket.create_connection((ip, HONK_PORT), timeout=2) as sock:
            sock.sendall(HONK_MESSAGE)
        return True
    except OSError:
        return False


def _is_listening(ip: str) -> bool:
    try:
        with socket.create_connection((ip, HONK_PORT), timeout=1):
            return True
    except OSError:
        return False


def _wait_until_listening(timeout: float = 10.0) -> bool:
    """Poll our own port until the freshly installed daemon comes up."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if _is_listening("127.0.0.1"):
            return True
        time.sleep(0.5)
    return False


def _install() -> None:
    uv_bin = shutil.which("uv")
    if not uv_bin:
        console.print("[red]uv not found on PATH - cannot install the listener.[/red]")
        raise typer.Exit(1)

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    PLIST_PATH.parent.mkdir(parents=True, exist_ok=True)
    plist = {
        "Label": PLIST_LABEL,
        "ProgramArguments": [uv_bin, "run", "--script", str(DAEMON_PATH)],
        "EnvironmentVariables": {"PATH": DAEMON_PATH_ENV},
        "RunAtLoad": True,
        "KeepAlive": True,
        "ProcessType": "Background",
        "StandardOutPath": str(LOG_PATH),
        "StandardErrorPath": str(LOG_PATH),
    }
    with PLIST_PATH.open("wb") as handle:
        plistlib.dump(plist, handle)

    domain = f"gui/{os.getuid()}"
    # Tear down any previous instance so a re-run reloads cleanly.
    subprocess.run(
        ["launchctl", "bootout", domain, str(PLIST_PATH)], capture_output=True
    )
    result = subprocess.run(
        ["launchctl", "bootstrap", domain, str(PLIST_PATH)],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        console.print(
            f"[red]Failed to start the listener:[/red] {result.stderr.strip()}"
        )
        raise typer.Exit(1)


def _uninstall() -> None:
    if not PLIST_PATH.exists():
        console.print("Honk listener is not installed.")
        return
    subprocess.run(
        ["launchctl", "bootout", f"gui/{os.getuid()}", str(PLIST_PATH)],
        capture_output=True,
    )
    PLIST_PATH.unlink(missing_ok=True)
    console.print("[bold]Honk listener removed.[/bold] You will no longer receive honks.")


def _prompt_install() -> None:
    console.print(
        "The honk listener runs quietly in the background so teammates can honk you."
    )
    console.print("[dim]It only accepts honks from the Polar tailnet.[/dim]\n")
    if not typer.confirm("Install it now?", default=True):
        console.print("[dim]Skipped. Run `dev honk` again whenever you want in.[/dim]")
        return
    _install()
    console.print("\n[bold green]You're in![/bold green]")
    if _wait_until_listening():
        console.print()
        _list_honkable()
    else:
        console.print(
            "[dim]Your listener is still starting - run `dev honk` again "
            "in a moment to see who you can honk.[/dim]"
        )


def _list_honkable() -> None:
    """Print teammates who are online and running the honk listener."""
    status = _tailscale_status()
    if not status:
        console.print("[yellow]Couldn't reach Tailscale to list teammates.[/yellow]")
        return

    online = [p for p in _peers(status) if p["online"]]
    if not online:
        console.print("[dim]Nobody is on the tailnet right now.[/dim]")
        return

    with ThreadPoolExecutor(max_workers=16) as pool:
        reachable = list(pool.map(lambda p: _is_listening(p["ip"]), online))
    honkable = [peer for peer, live in zip(online, reachable) if live]
    if not honkable:
        console.print("[dim]Nobody has the honk listener running yet.[/dim]")
        return

    self_person = next((p["person"] for p in honkable if p["is_self"]), None)
    console.print("[bold]Honkable right now:[/bold]")
    for person in sorted({peer["person"] for peer in honkable}):
        suffix = " [dim](you)[/dim]" if person == self_person else ""
        console.print(f"  [cyan]{person}[/cyan]{suffix}")
    console.print("\n[dim]Honk someone with dev honk <name>.[/dim]")


def _show_status() -> None:
    if _is_listening("127.0.0.1"):
        console.print("[green]Your honk listener is running.[/green]\n")
    else:
        console.print(
            "[yellow]Your honk listener is installed but not responding.[/yellow]"
        )
        console.print("[dim]It may still be starting - try again in a few seconds.[/dim]\n")
    _list_honkable()


def _do_honk(query: str) -> None:
    status = _tailscale_status()
    if not status:
        console.print(
            "[red]Couldn't reach Tailscale.[/red] "
            "Make sure it is running and you are signed in."
        )
        raise typer.Exit(1)

    matches = [p for p in _match(_peers(status), query) if p["online"]]
    if not matches:
        console.print(f"[yellow]No online teammate matches '{query}'.[/yellow]")
        console.print("[dim]Run `dev honk` to see who's around.[/dim]")
        raise typer.Exit(1)

    people = sorted({peer["person"] for peer in matches})
    if len(people) > 1:
        console.print(f"[yellow]'{query}' matches several people:[/yellow] {', '.join(people)}")
        console.print("[dim]Be more specific.[/dim]")
        raise typer.Exit(1)

    delivered = [peer for peer in matches if _send_honk(peer["ip"])]
    if delivered:
        console.print(f"[bold green]Honked {people[0]}![/bold green]")
        if not PLIST_PATH.exists():
            console.print(
                "[dim]You aren't honkable yourself yet - run `dev honk` to opt in.[/dim]"
            )
        return

    console.print(
        f"[yellow]{people[0]} is online but not running the honk listener.[/yellow]"
    )
    console.print("[dim]They can opt in with `dev honk`.[/dim]")
    raise typer.Exit(1)


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def honk(
        username: str | None = typer.Argument(
            None, help="Teammate to honk (name, machine, or login)"
        ),
        remove: bool = typer.Option(
            False, "--remove", help="Stop and uninstall your honk listener"
        ),
        list_peers: bool = typer.Option(
            False, "--list", help="Show who you can honk right now"
        ),
    ) -> None:
        """Honk a teammate over Tailscale, or manage your own listener.

        \b
        dev honk            Install your listener (first run), or show who's online
        dev honk <name>     Send a honk to a teammate
        dev honk --list     Show who you can honk right now
        dev honk --remove   Stop and uninstall your listener
        """
        if platform.system() != "Darwin":
            console.print("[yellow]dev honk is macOS-only for now.[/yellow]")
            raise typer.Exit(1)

        if remove:
            _uninstall()
            return

        if _tailscale_bin() is None:
            console.print("[red]Tailscale isn't installed.[/red]")
            console.print(
                "Honk works over the Polar tailnet. Install Tailscale with:\n"
            )
            console.print("  [bold]brew install --cask tailscale[/bold]\n")
            console.print(
                "[dim]Then open Tailscale and sign in with your Polar account.[/dim]"
            )
            raise typer.Exit(1)

        if list_peers:
            _list_honkable()
        elif username:
            _do_honk(username)
        elif PLIST_PATH.exists():
            _show_status()
        else:
            _prompt_install()
