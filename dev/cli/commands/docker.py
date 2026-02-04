"""Docker-based isolated development environment.

Runs the full Polar stack (API, worker, web, DB, Redis, MinIO) in Docker
containers with support for multiple isolated instances via port offsets.
"""

import hashlib
import os
import shutil
from pathlib import Path
from typing import Annotated, Optional

import typer

from shared import ROOT_DIR, console, run_command

DOCKER_DIR = ROOT_DIR / "dev" / "docker"
COMPOSE_FILE = DOCKER_DIR / "docker-compose.dev.yml"
ENV_TEMPLATE = DOCKER_DIR / ".env.docker.template"
ENV_FILE = DOCKER_DIR / ".env.docker"

VALID_SERVICES = ["api", "worker", "web", "db", "redis", "minio", "minio-setup", "prometheus", "grafana"]


def _detect_instance() -> int:
    """Auto-detect instance number from environment.

    Priority:
    1. CONDUCTOR_PORT env var → (port - 55000) / 10 + 1 (avoids instance 0)
    2. Workspace path hash → stable instance derived from ROOT_DIR
    """
    conductor_port = os.environ.get("CONDUCTOR_PORT")
    if conductor_port:
        try:
            port = int(conductor_port)
            return (port - 55000) // 10 + 1
        except ValueError:
            pass

    # Derive a stable instance from the workspace path
    path_hash = hashlib.md5(str(ROOT_DIR).encode()).hexdigest()
    return int(path_hash[:4], 16) % 99 + 1  # 1-99, avoids 0


def _ensure_env_file() -> None:
    """Create .env.docker from template if it doesn't exist."""
    if not ENV_FILE.exists():
        console.print("[dim]Creating Docker environment file from template...[/dim]")
        shutil.copy(ENV_TEMPLATE, ENV_FILE)


def _build_compose_env(instance: int) -> dict[str, str]:
    """Build environment variables with port offsets for the given instance."""
    offset = instance * 100
    return {
        "API_PORT": str(8000 + offset),
        "WEB_PORT": str(3000 + offset),
        "DB_PORT": str(5432 + offset),
        "REDIS_PORT": str(6379 + offset),
        "MINIO_API_PORT": str(9000 + offset),
        "MINIO_CONSOLE_PORT": str(9001 + offset),
        "PROMETHEUS_PORT": str(9090 + offset),
        "GRAFANA_PORT": str(3001 + offset),
    }


def _build_compose_cmd(instance: int, monitoring: bool = False) -> list[str]:
    """Build the base docker compose command."""
    project_name = f"polar-dev-{instance}"
    cmd = [
        "docker", "compose",
        "-p", project_name,
        "-f", str(COMPOSE_FILE),
        "--env-file", str(ENV_FILE),
    ]
    if monitoring:
        cmd.extend(["--profile", "monitoring"])
    return cmd


def _resolve_instance(instance: int | None) -> int:
    """Resolve instance number: use explicit value or auto-detect."""
    if instance is not None:
        return instance
    detected = _detect_instance()
    if detected != 0:
        console.print(f"[dim]Auto-detected instance {detected}[/dim]")
    return detected


def _print_access_info(instance: int, monitoring: bool = False) -> None:
    """Print service access URLs."""
    offset = instance * 100
    console.print()
    console.print("[bold]Polar Docker Development Environment[/bold]")
    console.print(f"Instance: {instance}")
    console.print()
    console.print("[bold]Services:[/bold]")
    console.print(f"  API:           http://localhost:{8000 + offset}")
    console.print(f"  Web:           http://localhost:{3000 + offset}")
    console.print(f"  MinIO Console: http://localhost:{9001 + offset}")
    console.print(f"  PostgreSQL:    localhost:{5432 + offset}")
    console.print(f"  Redis:         localhost:{6379 + offset}")
    if monitoring:
        console.print(f"  Prometheus:    http://localhost:{9090 + offset}")
        console.print(f"  Grafana:       http://localhost:{3001 + offset} (admin/polar)")
    console.print()
    console.print("[bold]Commands:[/bold]")
    i_flag = f" -i {instance}" if instance != 0 else ""
    console.print(f"  View logs:   dev docker{i_flag} logs")
    console.print(f"  API logs:    dev docker{i_flag} logs api")
    console.print(f"  Stop:        dev docker{i_flag} down")
    console.print(f"  Shell (API): dev docker{i_flag} shell api")
    console.print()


def register(app: typer.Typer, prompt_setup: callable) -> None:
    docker_app = typer.Typer(help="Isolated Docker development environment")
    app.add_typer(docker_app, name="docker")

    @docker_app.command("up")
    def docker_up(
        instance: Annotated[
            Optional[int], typer.Option("--instance", "-i", help="Instance number for port isolation (auto-detected if not set)")
        ] = None,
        detach: Annotated[
            bool, typer.Option("--detach", "-d", help="Run in background")
        ] = False,
        build: Annotated[
            bool, typer.Option("--build", "-b", help="Force rebuild images")
        ] = False,
        monitoring: Annotated[
            bool, typer.Option("--monitoring", help="Include Prometheus and Grafana")
        ] = False,
        services: Annotated[
            Optional[list[str]], typer.Argument(help="Services to start (default: all)")
        ] = None,
    ) -> None:
        """Start the full stack in Docker containers."""
        instance = _resolve_instance(instance)
        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance, monitoring)

        console.print(f"\n[bold blue]Starting Polar Docker environment (instance {instance})[/bold blue]\n")

        if build:
            console.print("[dim]Building images...[/dim]")
            build_cmd = cmd + ["build"] + (services or [])
            result = run_command(build_cmd, env=env)
            if result and result.returncode != 0:
                console.print("[red]Build failed[/red]")
                raise typer.Exit(1)

        up_cmd = cmd + ["up"]
        if detach:
            up_cmd.append("-d")
        up_cmd.extend(services or [])

        if detach:
            result = run_command(up_cmd, env=env)
            if result and result.returncode == 0:
                _print_access_info(instance, monitoring)
            else:
                console.print("[red]Failed to start services[/red]")
                raise typer.Exit(1)
        else:
            full_env = {**os.environ, **env}
            os.execvpe(up_cmd[0], up_cmd, full_env)

    @docker_app.command("down")
    def docker_down(
        instance: Annotated[
            Optional[int], typer.Option("--instance", "-i", help="Instance number (auto-detected if not set)")
        ] = None,
        services: Annotated[
            Optional[list[str]], typer.Argument(help="Services to stop (default: all)")
        ] = None,
    ) -> None:
        """Stop Docker services."""
        instance = _resolve_instance(instance)
        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance) + ["down"] + (services or [])

        console.print(f"[dim]Stopping Polar Docker environment (instance {instance})...[/dim]")
        result = run_command(cmd, env=env)
        if result and result.returncode == 0:
            console.print("[green]Environment stopped[/green]")
        else:
            console.print("[red]Failed to stop environment[/red]")
            raise typer.Exit(1)

    @docker_app.command("logs")
    def docker_logs(
        instance: Annotated[
            Optional[int], typer.Option("--instance", "-i", help="Instance number (auto-detected if not set)")
        ] = None,
        follow: Annotated[
            bool, typer.Option("--follow", "-f", help="Follow log output")
        ] = True,
        service: Annotated[
            Optional[str], typer.Argument(help="Service to show logs for")
        ] = None,
    ) -> None:
        """View Docker service logs."""
        instance = _resolve_instance(instance)
        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance) + ["logs"]
        if follow:
            cmd.append("-f")
        if service:
            cmd.append(service)

        full_env = {**os.environ, **env}
        os.execvpe(cmd[0], cmd, full_env)

    @docker_app.command("ps")
    def docker_ps(
        instance: Annotated[
            Optional[int], typer.Option("--instance", "-i", help="Instance number (auto-detected if not set)")
        ] = None,
    ) -> None:
        """List running Docker services."""
        instance = _resolve_instance(instance)
        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance) + ["ps"]
        result = run_command(cmd, env=env)
        if result and result.returncode != 0:
            raise typer.Exit(1)

    @docker_app.command("restart")
    def docker_restart(
        instance: Annotated[
            Optional[int], typer.Option("--instance", "-i", help="Instance number (auto-detected if not set)")
        ] = None,
        services: Annotated[
            Optional[list[str]], typer.Argument(help="Services to restart (default: all)")
        ] = None,
    ) -> None:
        """Restart Docker services."""
        instance = _resolve_instance(instance)
        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance) + ["restart"] + (services or [])

        console.print("[dim]Restarting services...[/dim]")
        result = run_command(cmd, env=env)
        if result and result.returncode == 0:
            console.print("[green]Services restarted[/green]")
        else:
            console.print("[red]Failed to restart services[/red]")
            raise typer.Exit(1)

    @docker_app.command("build")
    def docker_build(
        instance: Annotated[
            Optional[int], typer.Option("--instance", "-i", help="Instance number (auto-detected if not set)")
        ] = None,
        services: Annotated[
            Optional[list[str]], typer.Argument(help="Services to build (default: all)")
        ] = None,
    ) -> None:
        """Build or rebuild Docker images."""
        instance = _resolve_instance(instance)
        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance) + ["build"] + (services or [])

        console.print("[dim]Building images...[/dim]")
        result = run_command(cmd, env=env)
        if result and result.returncode == 0:
            console.print("[green]Build complete[/green]")
        else:
            console.print("[red]Build failed[/red]")
            raise typer.Exit(1)

    @docker_app.command("shell")
    def docker_shell(
        service: Annotated[
            str, typer.Argument(help="Service to open shell in (e.g. api, web)")
        ],
        instance: Annotated[
            Optional[int], typer.Option("--instance", "-i", help="Instance number (auto-detected if not set)")
        ] = None,
    ) -> None:
        """Open a shell in a Docker container."""
        instance = _resolve_instance(instance)
        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance) + ["exec", service, "/bin/bash"]

        console.print(f"[dim]Opening shell in {service} (instance {instance})...[/dim]")
        full_env = {**os.environ, **env}
        os.execvpe(cmd[0], cmd, full_env)

    @docker_app.command("cleanup")
    def docker_cleanup(
        instance: Annotated[
            Optional[int], typer.Option("--instance", "-i", help="Instance number (auto-detected if not set)")
        ] = None,
        force: Annotated[
            bool, typer.Option("--force", "-f", help="Skip confirmation")
        ] = False,
    ) -> None:
        """Stop services and remove all volumes (fresh start)."""
        instance = _resolve_instance(instance)
        if not force:
            console.print("[yellow]This will remove all containers and volumes (database data, etc.).[/yellow]")
            if not typer.confirm("Continue?"):
                raise typer.Abort()

        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance) + ["down", "-v", "--remove-orphans"]

        console.print(f"[dim]Cleaning up Polar Docker environment (instance {instance})...[/dim]")
        result = run_command(cmd, env=env)
        if result and result.returncode == 0:
            console.print("[green]Environment cleaned up (containers and volumes removed)[/green]")
        else:
            console.print("[red]Cleanup failed[/red]")
            raise typer.Exit(1)
