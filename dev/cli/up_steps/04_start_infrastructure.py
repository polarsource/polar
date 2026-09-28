"""Start Docker infrastructure (PostgreSQL, Redis, Minio, Tinybird)."""

from shared import (
    SERVER_DIR,
    Context,
    run_command,
    step_failed,
    step_spinner,
    step_status,
)

NAME = "Starting infrastructure"

# One-shot jobs like minio-setup exit on purpose and are not in this list.
LONG_RUNNING_SERVICES = ("db", "redis", "minio", "tinybird")


def get_running_services() -> set[str]:
    """Return compose service names whose containers are currently running."""
    result = run_command(
        ["docker", "compose", "ps", "--format", "{{.Service}} {{.State}}"],
        cwd=SERVER_DIR,
        capture=True,
    )
    running: set[str] = set()
    if result and result.returncode == 0:
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            service, _, state = line.partition(" ")
            if service and state.lower() == "running":
                running.add(service)
    return running


def run(ctx: Context) -> bool:
    """Start Docker containers."""
    running = get_running_services()
    missing = [service for service in LONG_RUNNING_SERVICES if service not in running]

    if not missing and not ctx.clean:
        step_status(True, "Docker containers", "already running")
        return True

    compose_cmd = ["docker", "compose"]
    compose_cmd.extend(["up", "-d"])

    service_name = "PostgreSQL, Redis, Minio, Tinybird"

    with step_spinner(f"Starting {service_name}..."):
        result = run_command(
            compose_cmd,
            cwd=SERVER_DIR,
            capture=True,
        )

    if result and result.returncode == 0:
        started = sorted(get_running_services())
        if missing and running:
            detail = f"started {', '.join(missing)}"
        elif started:
            detail = f"started ({', '.join(started)})"
        else:
            detail = "started"
        step_status(True, "Docker containers", detail)
        return True
    else:
        output = f"{result.stdout}\n{result.stderr}" if result else ""
        if "port is already allocated" in output or "address already in use" in output:
            hints = (
                "Another program is using one of the ports (5432, 6379, 9000, 7181): stop it, or change the port in server/.env",
                "Find it with [bold]lsof -i :5432[/bold] (swap in the port from the error above)",
            )
        else:
            hints = (
                "[bold]docker compose ps -a[/bold] in server/ shows which container failed",
                "[bold]docker compose logs <service>[/bold] in server/ shows why",
                "Is Docker Desktop running and finished starting? Check the whale icon in the menu bar",
            )
        step_failed("Docker containers", "failed to start", result, hints)
        return False
