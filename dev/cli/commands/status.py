"""Show comprehensive environment status."""

import platform
from dataclasses import dataclass

import typer

from shared import (
    CLIENTS_DIR,
    DEFAULT_API_PORT,
    DEFAULT_DB_PORT,
    DEFAULT_MINIO_PORT,
    DEFAULT_REDIS_PORT,
    DEFAULT_TINYBIRD_PORT,
    DEFAULT_WEB_PORT,
    SERVER_DIR,
    check_env_file_exists,
    check_node_modules_exists,
    check_venv_exists,
    console,
    is_port_in_use,
    run_command,
    step_status,
)


@dataclass
class ContainerStatus:
    running: bool
    restart_count: int
    memory_usage: str = ""


def _get_system_ram_bytes() -> int | None:
    """Get total system RAM in bytes."""
    try:
        if platform.system() == "Darwin":
            result = run_command(["sysctl", "-n", "hw.memsize"], capture=True)
            if result and result.returncode == 0:
                return int(result.stdout.strip())
        else:
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        return int(line.split()[1]) * 1024
    except (ValueError, OSError):
        pass
    return None


def _parse_mem_to_bytes(mem: str) -> int | None:
    """Parse a Docker memory string like '3.884GiB' or '56.03MiB' to bytes."""
    mem = mem.strip()
    units = {"KiB": 1024, "MiB": 1024**2, "GiB": 1024**3, "TiB": 1024**4}
    for suffix, multiplier in units.items():
        if mem.endswith(suffix):
            try:
                return int(float(mem[: -len(suffix)]) * multiplier)
            except ValueError:
                return None
    return None


def get_docker_compose_status() -> dict[str, ContainerStatus]:
    """Get status and restart counts of docker compose services."""
    result = run_command(
        ["docker", "compose", "ps", "--format", "{{.Name}} {{.State}} {{.RunningFor}}"],
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
                    status[name] = ContainerStatus(
                        running=state == "running",
                        restart_count=0,
                    )

    # Get restart counts via docker inspect
    inspect_result = run_command(
        ["docker", "compose", "ps", "-q"],
        cwd=SERVER_DIR,
        capture=True,
    )
    if inspect_result and inspect_result.returncode == 0:
        container_ids = [cid for cid in inspect_result.stdout.strip().split("\n") if cid]
        if container_ids:
            inspect = run_command(
                ["docker", "inspect", "--format", "{{.Name}} {{.RestartCount}}", *container_ids],
                capture=True,
            )
            if inspect and inspect.returncode == 0:
                for line in inspect.stdout.strip().split("\n"):
                    if line:
                        parts = line.split()
                        if len(parts) >= 2:
                            # docker inspect names have a leading /
                            name = parts[0].lstrip("/")
                            try:
                                restart_count = int(parts[1])
                            except ValueError:
                                restart_count = 0
                            if name in status:
                                status[name].restart_count = restart_count

    # Get memory usage via docker stats
    stats_result = run_command(
        ["docker", "stats", "--no-stream", "--format", "{{.Name}} {{.MemUsage}}", *container_ids] if container_ids else [],
        capture=True,
    ) if inspect_result and inspect_result.returncode == 0 and container_ids else None
    if stats_result and stats_result.returncode == 0:
        total_ram_bytes = _get_system_ram_bytes()
        for line in stats_result.stdout.strip().split("\n"):
            if line:
                # Format: "container_name 123MiB / 7.5GiB"
                parts = line.split()
                if len(parts) >= 4:
                    name = parts[0]
                    mem = parts[1]
                    docker_limit = parts[3]
                    if name in status:
                        mem_bytes = _parse_mem_to_bytes(mem)
                        docker_limit_bytes = _parse_mem_to_bytes(docker_limit)
                        pcts = []
                        if mem_bytes and docker_limit_bytes:
                            docker_pct = (mem_bytes / docker_limit_bytes) * 100
                            pcts.append(f"{docker_pct:.1f}% of Docker")
                        if mem_bytes and total_ram_bytes:
                            sys_pct = (mem_bytes / total_ram_bytes) * 100
                            pcts.append(f"{sys_pct:.1f}% of system")
                        if pcts:
                            status[name].memory_usage = f"{mem} ({', '.join(pcts)})"
                        else:
                            status[name].memory_usage = mem

    return status


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def status() -> None:
        """Show comprehensive environment status."""
        console.print("\n[bold blue]Polar Development Environment Status[/bold blue]\n")

        # Infrastructure
        console.print("[bold]Infrastructure:[/bold]")
        docker_status = get_docker_compose_status()

        services = {
            "db": ("PostgreSQL", DEFAULT_DB_PORT),
            "redis": ("Redis", DEFAULT_REDIS_PORT),
            "minio": ("Minio", DEFAULT_MINIO_PORT),
            "tinybird": ("Tinybird", DEFAULT_TINYBIRD_PORT),
        }

        for service_key, (name, port) in services.items():
            match = next(
                (cs for container_name, cs in docker_status.items() if service_key in container_name),
                None,
            )
            if match and match.running:
                detail = f"running (port {port})"
                if match.memory_usage:
                    detail += f", RAM: {match.memory_usage}"
                if match.restart_count > 0:
                    detail += f" [yellow]({match.restart_count} restarts)[/yellow]"
                step_status(True, name, detail)
            else:
                detail = "not running"
                if match and match.restart_count > 0:
                    detail += f" [red]({match.restart_count} restarts — possible crash loop)[/red]"
                step_status(False, name, detail)

        # Environment files
        console.print("\n[bold]Environment:[/bold]")
        step_status(
            check_env_file_exists(SERVER_DIR / ".env"),
            "server/.env",
            "exists" if check_env_file_exists(SERVER_DIR / ".env") else "missing",
        )
        step_status(
            check_env_file_exists(CLIENTS_DIR / "apps" / "web" / ".env.local"),
            "clients/apps/web/.env.local",
            "exists" if check_env_file_exists(CLIENTS_DIR / "apps" / "web" / ".env.local") else "missing",
        )

        # Dependencies
        console.print("\n[bold]Dependencies:[/bold]")
        step_status(check_venv_exists(), "Python deps", "installed" if check_venv_exists() else "not installed")
        step_status(check_node_modules_exists(), "JS deps", "installed" if check_node_modules_exists() else "not installed")

        # Services (port check)
        console.print("\n[bold]Services:[/bold]")
        api_running = is_port_in_use(DEFAULT_API_PORT)
        web_running = is_port_in_use(DEFAULT_WEB_PORT)

        step_status(api_running, "API server", f"running (port {DEFAULT_API_PORT})" if api_running else "not running")
        step_status(False, "Worker", "unknown (check manually)")
        step_status(web_running, "Web", f"running (port {DEFAULT_WEB_PORT})" if web_running else "not running")
        console.print()
