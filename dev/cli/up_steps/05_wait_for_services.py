"""Wait for infrastructure services to be healthy."""

import time

from shared import (
    Context,
    SERVER_DIR,
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


def run(ctx: Context) -> bool:
    """Wait for PostgreSQL and Redis to be ready."""
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

    return True
