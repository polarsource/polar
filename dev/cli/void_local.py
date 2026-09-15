"""Void services sharing the regular Polar development database and API."""

import json
import os
import time
import urllib.request

from dotenv import dotenv_values, set_key

from shared import SERVER_DIR, console, run_command

ENV_FILE = SERVER_DIR / ".env.void"


def environment() -> dict[str, str]:
    return {
        key: value
        for key, value in dotenv_values(ENV_FILE, interpolate=False).items()
        if value is not None
    }


def start_infrastructure() -> bool:
    result = run_command(
        [
            "docker",
            "compose",
            "up",
            "-d",
            "--wait",
            "--wait-timeout",
            "120",
            "tinybird",
            "temporal",
        ],
        cwd=SERVER_DIR,
        env=ports(),
    )
    return result is not None and result.returncode == 0


def ports() -> dict[str, str]:
    configured = {
        **dotenv_values(SERVER_DIR / ".env", interpolate=False),
        **os.environ,
    }
    return {
        key: configured.get(key) or default
        for key, default in {
            "TINYBIRD_PORT": "7181",
            "POLAR_VOID_TEMPORAL_PORT": "7233",
            "POLAR_VOID_TEMPORAL_UI_PORT": "8233",
        }.items()
    }


def setup() -> bool:
    local_ports = ports()
    values = {
        **local_ports,
        "POLAR_VOID_TINYBIRD_API_URL": f"http://localhost:{local_ports['TINYBIRD_PORT']}",
        "POLAR_VOID_TEMPORAL_ADDRESS": f"localhost:{local_ports['POLAR_VOID_TEMPORAL_PORT']}",
        "POLAR_VOID_TEMPORAL_NAMESPACE": "default",
        "POLAR_VOID_TEMPORAL_TASK_QUEUE": "polar-void",
        "POLAR_VOID_TEMPORAL_TLS": "false",
        "POLAR_VOID_TEMPORAL_API_KEY": "",
    }
    deadline = time.monotonic() + 60
    while True:
        try:
            with urllib.request.urlopen(
                f"{values['POLAR_VOID_TINYBIRD_API_URL']}/tokens", timeout=10
            ) as response:
                values["POLAR_VOID_TINYBIRD_API_TOKEN"] = json.load(response)[
                    "admin_token"
                ]
            break
        except (OSError, ValueError, KeyError) as error:
            if time.monotonic() >= deadline:
                console.print(
                    f"[red]Could not read the local Tinybird token: {error}[/red]"
                )
                return False
            time.sleep(1)

    for command in (
        ["uv", "run", "task", "void_tb_deploy", "--local", "--shared"],
        ["uv", "run", "task", "void_seed", "--output", str(ENV_FILE)],
    ):
        result = run_command(command, cwd=SERVER_DIR, env=values)
        if result is None or result.returncode != 0:
            return False

    for key, value in values.items():
        set_key(ENV_FILE, key, value, export=True)
    console.print(
        "[green]Void configured.[/green] Run [bold]dev api[/bold] and [bold]dev void[/bold]."
    )
    return True
