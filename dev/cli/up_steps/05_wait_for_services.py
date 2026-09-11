"""Wait for infrastructure services to be healthy."""

import json
import time
import urllib.request

from shared import (
    ROOT_DIR,
    SERVER_DIR,
    Context,
    console,
    print_output_tail,
    run_command,
    step_spinner,
    step_status,
    update_secrets,
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


def _report_service_timeout(label: str, service: str, timeout: int) -> None:
    step_status(False, label, f"not ready after {timeout}s")
    status = run_command(
        ["docker", "compose", "ps", "-a", service, "--format", "{{.Name}}: {{.Status}}"],
        cwd=SERVER_DIR,
        capture=True,
    )
    if status and status.stdout.strip():
        console.print(f"    [dim]{status.stdout.strip()}[/dim]")
    logs = run_command(
        ["docker", "compose", "logs", "--no-color", "--tail", "10", service],
        cwd=SERVER_DIR,
        capture=True,
    )
    console.print(f"  [bold]Last log lines from the {service} container:[/bold]")
    print_output_tail(logs, lines=10)
    console.print("  [bold]To fix:[/bold]")
    console.print(
        "    • A container that exited right away usually means server/.env is missing or incomplete:"
        " run [bold]./dev/setup-environment[/bold], then [bold]dev up[/bold] again"
    )
    console.print(
        f"    • Otherwise restart it with [bold]docker compose restart {service}[/bold] in server/"
        f" and check [bold]docker compose logs {service}[/bold]"
    )


def run(ctx: Context) -> bool:
    """Wait for PostgreSQL, Redis, and optionally Tinybird to be ready."""
    with step_spinner("Waiting for PostgreSQL..."):
        if wait_for_postgres(timeout=60):
            step_status(True, "PostgreSQL", "ready")
        else:
            _report_service_timeout("PostgreSQL", "db", 60)
            return False

    with step_spinner("Waiting for Redis..."):
        if wait_for_redis(timeout=60):
            step_status(True, "Redis", "ready")
        else:
            _report_service_timeout("Redis", "redis", 60)
            return False

    with step_spinner("Waiting for Tinybird..."):
        token = wait_for_tinybird_and_get_token(timeout=90)
        if token:
            update_secrets(
                {
                    "POLAR_TINYBIRD_API_TOKEN": token,
                    "POLAR_TINYBIRD_READ_TOKEN": token,
                    "POLAR_TINYBIRD_CLICKHOUSE_TOKEN": token,
                }
            )
            run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)
            step_status(True, "Tinybird", "ready (token configured)")
        else:
            step_status(False, "Tinybird", "timeout - continuing without it")
            # Don't fail the whole setup for tinybird

    return True
