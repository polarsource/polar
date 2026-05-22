# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""Polar honk listener.

Plays a sound when a teammate honks you over the Polar Tailscale network.
Runs as a launchd agent installed by `dev honk`. Pure stdlib, no dependencies.
"""

import json
import shutil
import socket
import subprocess
import sys
from datetime import datetime
from pathlib import Path

HONK_PORT = 45645
HONK_MAGIC = b"HONK"
SOUND_DIR = Path(__file__).resolve().parent
AUDIO_SUFFIXES = {".mp3", ".wav", ".aiff", ".m4a", ".aac"}

TAILSCALE_CANDIDATES = (
    "/opt/homebrew/bin/tailscale",
    "/usr/local/bin/tailscale",
    "/Applications/Tailscale.app/Contents/MacOS/Tailscale",
)


def log(message: str) -> None:
    print(f"{datetime.now():%Y-%m-%d %H:%M:%S} {message}", flush=True)


def tailscale_bin() -> str | None:
    found = shutil.which("tailscale")
    if found:
        return found
    for candidate in TAILSCALE_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    return None


def whois(ip: str) -> str | None:
    """Resolve a tailnet IP to a person's name, or None if not a tailnet peer."""
    ts = tailscale_bin()
    if not ts:
        return None
    try:
        result = subprocess.run(
            [ts, "whois", "--json", ip],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (subprocess.SubprocessError, OSError):
        return None
    if result.returncode != 0:
        return None
    try:
        profile = json.loads(result.stdout).get("UserProfile") or {}
    except json.JSONDecodeError:
        return None
    login = profile.get("LoginName") or ""
    if "@" in login:
        return login.split("@", 1)[0]
    return login or profile.get("DisplayName") or "a teammate"


def sound_file() -> Path | None:
    """The bundled honk sound, if one was added (honk.mp3, honk.wav, ...)."""
    for path in sorted(SOUND_DIR.glob("honk.*")):
        if path.suffix.lower() in AUDIO_SUFFIXES:
            return path
    return None


def play_honk(name: str) -> None:
    sound = sound_file()
    if sound is not None:
        subprocess.Popen(["afplay", str(sound)])
    else:
        subprocess.Popen(["say", "honk! honk!"])
    # AppleScript strings are double-quoted; neutralise quotes/backslashes.
    safe_name = name.replace("\\", "").replace('"', "'")
    subprocess.Popen(
        [
            "osascript",
            "-e",
            f'display notification "Honked by {safe_name}" with title "HONK"',
        ]
    )


def handle(conn: socket.socket, addr: tuple[str, int]) -> None:
    ip = addr[0]
    try:
        conn.settimeout(2)
        data = conn.recv(64)
    except OSError:
        return
    finally:
        conn.close()
    if not data.startswith(HONK_MAGIC):
        return
    name = whois(ip)
    if name is None:
        log(f"Ignored honk from non-tailnet address {ip}")
        return
    log(f"Honked by {name} ({ip})")
    play_honk(name)


def main() -> None:
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        server.bind(("0.0.0.0", HONK_PORT))
    except OSError as error:
        log(f"Could not bind port {HONK_PORT}: {error}")
        sys.exit(1)
    server.listen(8)
    found = sound_file()
    label = found.name if found is not None else "say fallback"
    log(f"Honk listener ready on port {HONK_PORT} (sound: {label})")

    while True:
        try:
            conn, addr = server.accept()
        except OSError as error:
            log(f"accept failed: {error}")
            continue
        try:
            handle(conn, addr)
        except Exception as error:  # noqa: BLE001 - one bad honk must not kill the daemon
            log(f"error handling honk: {error}")


if __name__ == "__main__":
    main()
