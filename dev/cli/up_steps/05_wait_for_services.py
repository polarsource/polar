"""Wait for infrastructure services to be healthy."""

import json
import time
import urllib.request

from shared import (
    SERVER_DIR,
    Context,
    console,
    run_command,
    step_status,
)

NAME = "Waiting for services to be ready"


def wait_for_postgres(timeout: int = 60) -> bool:
    """Wait for PostgreSQL to be ready."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        result = run_command(
            ["docker", "compose", "exec", "-T", "db", "pg_isready", "-U", "polar"],
            cwd=SERVER_DIR,
            capture=True,
        )
        if result and result.returncode == 0:
            return True
        time.sleep(1)
    return False


def wait_for_redis(timeout: int = 60) -> bool:
    """Wait for Redis to be ready."""
    start_time = time.time()
    while time.time() - start_time < timeout:
        result = run_command(
            ["docker", "compose", "exec", "-T", "redis", "redis-cli", "ping"],
            cwd=SERVER_DIR,
            capture=True,
        )
        if result and result.returncode == 0 and "PONG" in result.stdout:
            return True
        time.sleep(1)
    return False


def wait_for_tinybird_and_get_token(timeout: int = 90) -> str | None:
    """Wait for Tinybird to be ready and return the admin token.

    Tries to detect the host-mapped port via docker compose, falling
    back to the default port 7181.
    """
    # Try to get the mapped port from docker compose
    port = 7181
    result = run_command(
        ["docker", "compose", "port", "tinybird", "7181"],
        cwd=SERVER_DIR,
        capture=True,
    )
    if result and result.returncode == 0 and result.stdout.strip():
        try:
            port = int(result.stdout.strip().rsplit(":", 1)[-1])
        except ValueError:
            pass

    url = f"http://localhost:{port}/tokens"
    start_time = time.time()
    while time.time() - start_time < timeout:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                data = json.loads(resp.read())
                return data.get("admin_token")
        except Exception:
            time.sleep(2)
    return None


def _update_env_var(key: str, value: str) -> None:
    """Set an env var in server/.env, adding or updating as needed."""
    env_file = SERVER_DIR / ".env"
    if not env_file.exists():
        return

    lines = env_file.read_text().splitlines()
    found = False
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith(f"{key}=") or stripped.startswith(f"# {key}="):
            lines[i] = f'{key}="{value}"'
            found = True
            break

    if not found:
        lines.append(f'{key}="{value}"')

    env_file.write_text("\n".join(lines) + "\n")


def run(ctx: Context) -> bool:
    """Wait for PostgreSQL, Redis, and Tinybird to be ready."""
    with console.status("[bold]Waiting for PostgreSQL...[/bold]"):
        if wait_for_postgres(timeout=60):
            step_status(True, "PostgreSQL", "ready")
        else:
            step_status(False, "PostgreSQL", "timeout after 60s")
            return False

    with console.status("[bold]Waiting for Redis...[/bold]"):
        if wait_for_redis(timeout=60):
            step_status(True, "Redis", "ready")
        else:
            step_status(False, "Redis", "timeout after 60s")
            return False

    with console.status("[bold]Waiting for Tinybird...[/bold]"):
        token = wait_for_tinybird_and_get_token(timeout=90)
        if token:
            _update_env_var("POLAR_TINYBIRD_API_TOKEN", token)
            _update_env_var("POLAR_TINYBIRD_READ_TOKEN", token)
            _update_env_var("POLAR_TINYBIRD_CLICKHOUSE_TOKEN", token)
            step_status(True, "Tinybird", "ready (token configured)")
        else:
            step_status(False, "Tinybird", "timeout - continuing without it")
            # Don't fail the whole setup for tinybird

    return True
