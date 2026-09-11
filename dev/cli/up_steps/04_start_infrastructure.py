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


def get_docker_compose_status() -> dict[str, bool]:
    """Get status of docker compose services."""
    result = run_command(
        ["docker", "compose", "ps", "--format", "{{.Name}} {{.State}}"],
        cwd=SERVER_DIR,
        capture=True,
    )
    status = {}
    if result and result.returncode == 0:
        for line in result.stdout.strip().split("\n"):
            if line:
                parts = line.split()
                if len(parts) >= 2:
                    name = parts[0]
                    state = parts[1].lower()
                    status[name] = state == "running"
    return status


def run(ctx: Context) -> bool:
    """Start Docker containers."""
    docker_status = get_docker_compose_status()
    all_running = bool(docker_status) and all(docker_status.values())

    if all_running and not ctx.clean:
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
        # Show which containers were started
        new_status = get_docker_compose_status()
        services = [name.split("-")[-1] for name in new_status.keys() if new_status.get(name)]
        step_status(True, "Docker containers", f"started ({', '.join(services)})" if services else "started")
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
