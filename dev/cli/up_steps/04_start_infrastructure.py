"""Start Docker infrastructure (PostgreSQL, Redis, Minio)."""

from shared import (
    Context,
    SERVER_DIR,
    console,
    run_command,
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
    containers_running = any(docker_status.values()) if docker_status else False

    if containers_running and not ctx.clean:
        step_status(True, "Docker containers", "already running")
        return True

    with console.status("[bold]Starting PostgreSQL, Redis, Minio...[/bold]"):
        result = run_command(
            ["docker", "compose", "up", "-d"],
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
        step_status(False, "Docker containers", "failed to start")
        if result and result.stderr:
            console.print(f"[dim]{result.stderr}[/dim]")
        if result and result.stdout:
            console.print(f"[dim]{result.stdout}[/dim]")
        return False
