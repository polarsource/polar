"""Docker-based isolated development environment.

Runs the full Polar stack (API, worker, web, DB, Redis, MinIO) in Docker
containers with support for multiple isolated instances via port offsets.
"""

import hashlib
import os
import re
import shutil
from pathlib import Path
from typing import Annotated, Optional

import typer

from shared import ROOT_DIR, SECRETS_FILE, SERVER_DIR, console, run_command

DOCKER_DIR = ROOT_DIR / "dev" / "docker"
COMPOSE_FILE = DOCKER_DIR / "docker-compose.dev.yml"
ENV_TEMPLATE = DOCKER_DIR / ".env.docker.template"
ENV_FILE = DOCKER_DIR / ".env.docker"
SERVER_ENV_FILE = SERVER_DIR / ".env"
SERVER_ENV_TEMPLATE = SERVER_DIR / ".env.template"

VALID_SERVICES = ["api", "worker", "web", "db", "redis", "minio", "minio-setup", "prometheus", "grafana"]


def _read_stored_instance() -> int | None:
    """Read POLAR_DOCKER_INSTANCE from .env.docker if set."""
    if not ENV_FILE.exists():
        return None
    for line in ENV_FILE.read_text().splitlines():
        line = line.strip()
        if line.startswith("#") or not line:
            continue
        match = re.match(r"^POLAR_DOCKER_INSTANCE\s*=\s*(\d+)\s*$", line)
        if match:
            return int(match.group(1))
    return None


def _write_stored_instance(instance: int) -> None:
    """Write POLAR_DOCKER_INSTANCE to .env.docker."""
    _ensure_env_file()
    content = ENV_FILE.read_text()
    # Replace existing line (commented or not)
    new_line = f"POLAR_DOCKER_INSTANCE={instance}"
    if re.search(r"^#?\s*POLAR_DOCKER_INSTANCE\s*=", content, re.MULTILINE):
        content = re.sub(
            r"^#?\s*POLAR_DOCKER_INSTANCE\s*=.*$",
            new_line,
            content,
            flags=re.MULTILINE,
        )
    else:
        content = content.rstrip() + f"\n{new_line}\n"
    ENV_FILE.write_text(content)


def _clear_stored_instance() -> bool:
    """Comment out POLAR_DOCKER_INSTANCE in .env.docker. Returns True if found."""
    if not ENV_FILE.exists():
        return False
    content = ENV_FILE.read_text()
    if re.search(r"^POLAR_DOCKER_INSTANCE\s*=", content, re.MULTILINE):
        content = re.sub(
            r"^POLAR_DOCKER_INSTANCE\s*=.*$",
            "# POLAR_DOCKER_INSTANCE=",
            content,
            flags=re.MULTILINE,
        )
        ENV_FILE.write_text(content)
        return True
    return False


def _detect_instance() -> tuple[int, str]:
    """Auto-detect instance number from environment.

    Priority:
    1. POLAR_DOCKER_INSTANCE in .env.docker
    2. CONDUCTOR_PORT env var → (port - 55000) / 10 + 1
    3. Workspace path hash → stable instance derived from ROOT_DIR

    Returns (instance, source) tuple.
    """
    stored = _read_stored_instance()
    if stored is not None:
        return stored, "stored"

    conductor_port = os.environ.get("CONDUCTOR_PORT")
    if conductor_port:
        try:
            port = int(conductor_port)
            return (port - 55000) // 10 + 1, "auto"
        except ValueError:
            pass

    # Derive a stable instance from the workspace path
    path_hash = hashlib.md5(str(ROOT_DIR).encode()).hexdigest()
    return int(path_hash[:4], 16) % 99 + 1, "auto"  # 1-99, avoids 0


def _ensure_env_file() -> None:
    """Create .env.docker from template if it doesn't exist."""
    if not ENV_FILE.exists():
        console.print("[dim]Creating Docker environment file from template...[/dim]")
        shutil.copy(ENV_TEMPLATE, ENV_FILE)


def _load_central_secrets() -> dict[str, str]:
    """Load secrets from central file if it exists."""
    if not SECRETS_FILE.exists():
        return {}
    from dotenv import dotenv_values
    return {k: v for k, v in dotenv_values(SECRETS_FILE).items() if v}


def _ensure_server_env() -> None:
    """Create server/.env from template if it doesn't exist.

    Applies central secrets from ~/.config/polar/secrets.env when available,
    mirroring what `dev/setup-environment` does.
    """
    if SERVER_ENV_FILE.exists():
        return

    if not SERVER_ENV_TEMPLATE.exists():
        console.print("[red]server/.env.template not found[/red]")
        raise typer.Exit(1)

    console.print("[dim]Creating server/.env from template...[/dim]")

    from dotenv import dotenv_values

    template_env = dotenv_values(SERVER_ENV_TEMPLATE)
    central_secrets = _load_central_secrets()

    # Map backend secrets to frontend env vars
    if "POLAR_STRIPE_PUBLISHABLE_KEY" in central_secrets:
        central_secrets["NEXT_PUBLIC_STRIPE_KEY"] = central_secrets[
            "POLAR_STRIPE_PUBLISHABLE_KEY"
        ]
    if "POLAR_GITHUB_APP_NAMESPACE" in central_secrets:
        central_secrets["NEXT_PUBLIC_GITHUB_APP_NAMESPACE"] = central_secrets[
            "POLAR_GITHUB_APP_NAMESPACE"
        ]

    with open(SERVER_ENV_FILE, "w") as f:
        for key, value in template_env.items():
            output_value = central_secrets.get(key, value)
            delimiter = "'" if '"' in str(output_value) else '"'
            f.write(f"{key}={delimiter}{output_value}{delimiter}\n")

    if central_secrets:
        console.print(f"[dim]  Applied secrets from {SECRETS_FILE}[/dim]")


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


def _get_instance(ctx: typer.Context) -> int:
    """Get the resolved instance number from the context."""
    return ctx.obj["instance"]


def _instance_was_explicit(ctx: typer.Context) -> bool:
    """Check if the instance was explicitly provided by the user."""
    return ctx.obj["instance_explicit"]


def _print_access_info(ctx: typer.Context, instance: int, monitoring: bool = False) -> None:
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
    i_flag = f" -i {instance}" if _instance_was_explicit(ctx) else ""
    console.print(f"  View logs:   dev docker{i_flag} logs")
    console.print(f"  API logs:    dev docker{i_flag} logs api")
    console.print(f"  Stop:        dev docker{i_flag} down")
    console.print(f"  Shell (API): dev docker{i_flag} shell api")
    console.print()


def register(app: typer.Typer, prompt_setup: callable) -> None:
    docker_app = typer.Typer(help="Isolated Docker development environment")
    app.add_typer(docker_app, name="docker")

    @docker_app.callback()
    def docker_callback(
        ctx: typer.Context,
        instance: Annotated[
            Optional[int], typer.Option("--instance", "-i", help="Instance number for port isolation (auto-detected if not set)")
        ] = None,
    ) -> None:
        """Isolated Docker development environment."""
        explicit = instance is not None
        if instance is None:
            instance, source = _detect_instance()
            if source == "stored":
                console.print(f"[dim]Using stored instance {instance} (from .env.docker)[/dim]")
            else:
                console.print(f"[dim]Auto-detected instance {instance}[/dim]")
        ctx.ensure_object(dict)
        ctx.obj["instance"] = instance
        ctx.obj["instance_explicit"] = explicit

    @docker_app.command("up")
    def docker_up(
        ctx: typer.Context,
        detach: Annotated[
            bool, typer.Option("--detach", "-d", help="Run in background")
        ] = True,
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
        instance = _get_instance(ctx)
        _ensure_env_file()
        _ensure_server_env()
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
                _print_access_info(ctx, instance, monitoring)
            else:
                console.print("[red]Failed to start services[/red]")
                raise typer.Exit(1)
        else:
            full_env = {**os.environ, **env}
            os.execvpe(up_cmd[0], up_cmd, full_env)

    @docker_app.command("down")
    def docker_down(
        ctx: typer.Context,
        services: Annotated[
            Optional[list[str]], typer.Argument(help="Services to stop (default: all)")
        ] = None,
    ) -> None:
        """Stop Docker services."""
        instance = _get_instance(ctx)
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
        ctx: typer.Context,
        follow: Annotated[
            bool, typer.Option("--follow", "-f", help="Follow log output")
        ] = True,
        service: Annotated[
            Optional[str], typer.Argument(help="Service to show logs for")
        ] = None,
    ) -> None:
        """View Docker service logs."""
        instance = _get_instance(ctx)
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
        ctx: typer.Context,
    ) -> None:
        """List running Docker services."""
        instance = _get_instance(ctx)
        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance) + ["ps"]
        result = run_command(cmd, env=env)
        if result and result.returncode != 0:
            raise typer.Exit(1)

    @docker_app.command("restart")
    def docker_restart(
        ctx: typer.Context,
        services: Annotated[
            Optional[list[str]], typer.Argument(help="Services to restart (default: all)")
        ] = None,
    ) -> None:
        """Restart Docker services."""
        instance = _get_instance(ctx)
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
        ctx: typer.Context,
        services: Annotated[
            Optional[list[str]], typer.Argument(help="Services to build (default: all)")
        ] = None,
    ) -> None:
        """Build or rebuild Docker images."""
        instance = _get_instance(ctx)
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
        ctx: typer.Context,
        service: Annotated[
            str, typer.Argument(help="Service to open shell in (e.g. api, web)")
        ],
    ) -> None:
        """Open a shell in a Docker container."""
        instance = _get_instance(ctx)
        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance) + ["exec", service, "/bin/bash"]

        console.print(f"[dim]Opening shell in {service} (instance {instance})...[/dim]")
        full_env = {**os.environ, **env}
        os.execvpe(cmd[0], cmd, full_env)

    @docker_app.command("cleanup")
    def docker_cleanup(
        ctx: typer.Context,
        force: Annotated[
            bool, typer.Option("--force", "-f", help="Skip confirmation")
        ] = False,
    ) -> None:
        """Stop services and remove all volumes (fresh start)."""
        instance = _get_instance(ctx)
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

    @docker_app.command("set-instance")
    def docker_set_instance(
        instance: Annotated[
            int, typer.Argument(help="Instance number to store (0 = default ports)")
        ],
    ) -> None:
        """Store a default instance number in .env.docker."""
        if instance < 0:
            console.print("[red]Instance number must be >= 0[/red]")
            raise typer.Exit(1)
        _write_stored_instance(instance)
        offset = instance * 100
        console.print(f"[green]Stored instance {instance} in .env.docker[/green]")
        console.print(f"[dim]Ports: API={8000 + offset}, Web={3000 + offset}, DB={5432 + offset}[/dim]")

    @docker_app.command("clear-instance")
    def docker_clear_instance() -> None:
        """Remove stored instance number (back to auto-detect)."""
        if _clear_stored_instance():
            console.print("[green]Cleared stored instance from .env.docker[/green]")
        else:
            console.print("[dim]No stored instance to clear[/dim]")
