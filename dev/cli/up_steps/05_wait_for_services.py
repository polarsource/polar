"""Wait for infrastructure services to be healthy."""

import json
import time
import urllib.request

from shared import (
    ROOT_DIR,
    SECRETS_FILE,
    SERVER_DIR,
    Context,
    run_command,
    step_spinner,
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


def _update_secrets_file(key: str, value: str) -> None:
    """Update a key in the central secrets file."""
    SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing = {}
    if SECRETS_FILE.exists():
        for line in SECRETS_FILE.read_text().split("\n"):
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                existing[k.strip()] = v.strip().strip("\"'")

    existing[key] = value

    with open(SECRETS_FILE, "w") as f:
        f.write("# Polar Development Secrets\n")
        f.write("# Shared across Git worktrees\n\n")
        for k, v in existing.items():
            delimiter = "'" if '"' in v else '"'
            f.write(f"{k}={delimiter}{v}{delimiter}\n")


def run(ctx: Context) -> bool:
    """Wait for PostgreSQL, Redis, and Tinybird to be ready."""
    with step_spinner("Waiting for PostgreSQL..."):
        if wait_for_postgres(timeout=60):
            step_status(True, "PostgreSQL", "ready")
        else:
            step_status(False, "PostgreSQL", "timeout after 60s")
            return False

    with step_spinner("Waiting for Redis..."):
        if wait_for_redis(timeout=60):
            step_status(True, "Redis", "ready")
        else:
            step_status(False, "Redis", "timeout after 60s")
            return False

    with step_spinner("Waiting for Tinybird..."):
        token = wait_for_tinybird_and_get_token(timeout=90)
        if token:
            _update_secrets_file("POLAR_TINYBIRD_API_TOKEN", token)
            _update_secrets_file("POLAR_TINYBIRD_READ_TOKEN", token)
            _update_secrets_file("POLAR_TINYBIRD_CLICKHOUSE_TOKEN", token)
            run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)
            step_status(True, "Tinybird", "ready (token configured)")
        else:
            step_status(False, "Tinybird", "timeout - continuing without it")
            # Don't fail the whole setup for tinybird

    return True
