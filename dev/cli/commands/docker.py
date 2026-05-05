"""Docker-based isolated development environment.

One shared infra stack (db, redis, minio, tinybird, optional prometheus/
grafana) is brought up per machine; each worktree gets its own per-instance
app stack (api, worker, web) using its own postgres DB, Redis DB index, and
S3 bucket pair. Service-aware commands auto-route by service name to the
right project. `dev docker up` starts shared (if needed) then this instance.
"""

import hashlib
import os
import re
import shutil
import subprocess
from typing import Annotated

import typer

from shared import ROOT_DIR, SECRETS_FILE, SERVER_DIR, console, run_command

DOCKER_DIR = ROOT_DIR / "dev" / "docker"
COMPOSE_FILE = DOCKER_DIR / "docker-compose.dev.yml"
SHARED_COMPOSE_FILE = DOCKER_DIR / "docker-compose.shared.yml"
ENV_TEMPLATE = DOCKER_DIR / ".env.docker.template"
ENV_FILE = DOCKER_DIR / ".env.docker"
SERVER_ENV_FILE = SERVER_DIR / ".env"
SERVER_ENV_TEMPLATE = SERVER_DIR / ".env.template"

SHARED_PROJECT_NAME = "polar-shared"
SHARED_NETWORK_NAME = "polar-shared"

# Per-instance naming. Single source of truth — referenced both here and in
# docker-compose.dev.yml (via env interpolation) and dev/docker/scripts/startup.sh.
# Instance numbers from `_detect_instance` are in [1, 99]; the shared redis is
# launched with `--databases 100` so we can map instance → redis DB index 1:1
# (no modulo, no collisions).


def app_project(instance: int) -> str:
    return f"polar-app-{instance}"


def db_name(instance: int) -> str:
    return f"polar_dev_{instance}"


def redis_db(instance: int) -> int:
    return instance


def s3_bucket(instance: int) -> str:
    return f"polar-s3-{instance}"


def s3_public_bucket(instance: int) -> str:
    return f"polar-s3-public-{instance}"


APP_SERVICES = frozenset(("api", "worker", "web"))
SHARED_SERVICES = frozenset(
    (
        "db",
        "redis",
        "minio",
        "minio-setup",
        "tinybird",
        "prometheus",
        "grafana",
    )
)


# --------------------------------------------------------------------------- #
# Instance detection / persistence
# --------------------------------------------------------------------------- #


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


# --------------------------------------------------------------------------- #
# Env files
# --------------------------------------------------------------------------- #


def _ensure_env_file() -> None:
    """Create .env.docker from template if it doesn't exist."""
    if not ENV_FILE.exists():
        if not ENV_TEMPLATE.exists():
            # Template was optional in the original layout; tolerate absence.
            ENV_FILE.write_text(
                "# Polar Docker dev env\n"
                "# Set POLAR_DOCKER_INSTANCE=N to pin this worktree to instance N\n"
                "# POLAR_DOCKER_INSTANCE=\n"
            )
            return
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


# --------------------------------------------------------------------------- #
# Shared network + shared compose helpers
# --------------------------------------------------------------------------- #


def _ensure_network() -> None:
    """Idempotently create the polar-shared docker network."""
    result = subprocess.run(
        ["docker", "network", "inspect", SHARED_NETWORK_NAME],
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return
    create = subprocess.run(
        ["docker", "network", "create", SHARED_NETWORK_NAME],
        capture_output=True,
        text=True,
    )
    if create.returncode != 0:
        console.print(
            f"[red]Failed to create docker network {SHARED_NETWORK_NAME}: {create.stderr.strip()}[/red]"
        )
        raise typer.Exit(1)
    console.print(f"[dim]Created docker network: {SHARED_NETWORK_NAME}[/dim]")


def _shared_compose_cmd(monitoring: bool = False) -> list[str]:
    cmd = [
        "docker",
        "compose",
        "-p",
        SHARED_PROJECT_NAME,
        "-f",
        str(SHARED_COMPOSE_FILE),
    ]
    if monitoring:
        cmd.extend(["--profile", "monitoring"])
    return cmd


def _shared_is_running() -> bool:
    """Return True if any container in the shared project is running."""
    result = subprocess.run(
        [
            "docker",
            "compose",
            "-p",
            SHARED_PROJECT_NAME,
            "-f",
            str(SHARED_COMPOSE_FILE),
            "ps",
            "-q",
            "--status",
            "running",
        ],
        capture_output=True,
        text=True,
    )
    return result.returncode == 0 and bool(result.stdout.strip())


# --------------------------------------------------------------------------- #
# Per-instance compose helpers
# --------------------------------------------------------------------------- #


def _build_compose_env(instance: int) -> dict[str, str]:
    """Build environment variables for the per-instance app stack.

    Only API and WEB host ports are offset (those need to be reachable from
    the host browser). Infra services live in the shared stack and are
    reached by container name on the polar-shared network — no host ports.
    """
    offset = instance * 100
    return {
        "POLAR_DOCKER_INSTANCE": str(instance),
        "API_PORT": str(8000 + offset),
        "WEB_PORT": str(3000 + offset),
        "POLAR_POSTGRES_DATABASE": db_name(instance),
        "POLAR_REDIS_DB": str(redis_db(instance)),
        "POLAR_S3_FILES_BUCKET_NAME": s3_bucket(instance),
        "POLAR_S3_FILES_PUBLIC_BUCKET_NAME": s3_public_bucket(instance),
    }


def _build_compose_cmd(instance: int) -> list[str]:
    return [
        "docker",
        "compose",
        "-p",
        app_project(instance),
        "-f",
        str(COMPOSE_FILE),
        "--env-file",
        str(ENV_FILE),
    ]


def _get_instance(ctx: typer.Context) -> int:
    return ctx.obj["instance"]


def _instance_was_explicit(ctx: typer.Context) -> bool:
    return ctx.obj["instance_explicit"]


def _print_access_info(ctx: typer.Context, instance: int) -> None:
    offset = instance * 100
    i_flag = f" -i {instance}" if _instance_was_explicit(ctx) else ""
    console.print()
    console.print("[bold]Polar Docker Development Environment[/bold]")
    console.print(f"Instance: {instance} (project {app_project(instance)})")
    console.print(
        f"Database: {db_name(instance)}  Redis DB: {redis_db(instance)}  "
        f"Buckets: {s3_bucket(instance)}, {s3_public_bucket(instance)}"
    )
    console.print()
    console.print("[bold]App services:[/bold]")
    console.print(f"  API:           http://localhost:{8000 + offset}")
    console.print(f"  Web:           http://localhost:{3000 + offset}")
    console.print()
    console.print(
        "[bold]Shared infra:[/bold] (no host ports — reach via `dev docker exec <service>`)"
    )
    console.print(f"  Project: {SHARED_PROJECT_NAME}  Network: {SHARED_NETWORK_NAME}")
    console.print(f"  psql:    dev docker exec db psql -U polar -d {db_name(instance)}")
    console.print(f"  redis:   dev docker exec redis redis-cli -n {redis_db(instance)}")
    console.print()
    console.print("[bold]Commands:[/bold]")
    console.print(f"  View logs:   dev docker{i_flag} logs")
    console.print(f"  API logs:    dev docker{i_flag} logs api")
    console.print(f"  Stop:        dev docker{i_flag} down")
    console.print(f"  Shell (API): dev docker{i_flag} shell api")
    console.print()


# --------------------------------------------------------------------------- #
# Typer registration
# --------------------------------------------------------------------------- #


def register(app: typer.Typer, prompt_setup: callable) -> None:
    docker_app = typer.Typer(help="Isolated Docker development environment")
    app.add_typer(docker_app, name="docker")

    @docker_app.callback()
    def docker_callback(
        ctx: typer.Context,
        instance: Annotated[
            int | None,
            typer.Option(
                "--instance",
                "-i",
                help="Instance number for port isolation (auto-detected if not set)",
            ),
        ] = None,
    ) -> None:
        """Isolated Docker development environment.

        One shared infra stack (postgres/redis/minio/tinybird) lives on the
        machine; each worktree gets its own api/worker/web on offset ports.
        Service-aware commands (logs, exec, restart, ...) auto-route to the
        right project based on the service name.
        """
        explicit = instance is not None
        if instance is None:
            instance, source = _detect_instance()
            if source == "stored":
                console.print(
                    f"[dim]Using stored instance {instance} (from .env.docker)[/dim]"
                )
            else:
                console.print(f"[dim]Auto-detected instance {instance}[/dim]")
        ctx.ensure_object(dict)
        ctx.obj["instance"] = instance
        ctx.obj["instance_explicit"] = explicit

    def _route(service: str | None, instance: int) -> tuple[list[str], dict[str, str]]:
        """Pick the right (compose_cmd, env) for a service.

        - shared services (db, redis, minio, tinybird, prometheus, grafana) →
          the machine-wide `polar-shared` project
        - app services (api, worker, web) or no service → this instance's
          `polar-app-N` project
        """
        if service in SHARED_SERVICES:
            return _shared_compose_cmd(monitoring=True), {}
        return _build_compose_cmd(instance), _build_compose_env(instance)

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
            bool,
            typer.Option(
                "--monitoring", help="Include Prometheus and Grafana in shared infra"
            ),
        ] = False,
        services: Annotated[
            list[str] | None,
            typer.Argument(help="Services to start (default: all app services)"),
        ] = None,
    ) -> None:
        """Start shared infra (if needed) + this instance's app stack."""
        instance = _get_instance(ctx)
        _ensure_env_file()
        _ensure_server_env()

        # Bring shared infra up first if it isn't already running.
        _ensure_network()
        if not _shared_is_running():
            shared_cmd = _shared_compose_cmd(monitoring=monitoring) + ["up", "-d"]
            console.print("[bold blue]Starting Polar shared infra[/bold blue]")
            result = run_command(shared_cmd)
            if not result or result.returncode != 0:
                console.print("[red]Failed to start shared infra[/red]")
                raise typer.Exit(1)
        elif monitoring:
            console.print(
                "[yellow]Shared infra is already running; --monitoring only takes effect on first start. Run `dev docker down --all` first to apply.[/yellow]"
            )

        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance)

        console.print(
            f"\n[bold blue]Starting Polar app stack (instance {instance})[/bold blue]\n"
        )

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
                _print_access_info(ctx, instance)
            else:
                console.print("[red]Failed to start services[/red]")
                raise typer.Exit(1)
        else:
            full_env = {**os.environ, **env}
            os.execvpe(up_cmd[0], up_cmd, full_env)

    @docker_app.command("down")
    def docker_down(
        ctx: typer.Context,
        all_: Annotated[
            bool,
            typer.Option(
                "--all", help="Also stop the shared infra (postgres/redis/etc.)"
            ),
        ] = False,
        services: Annotated[
            list[str] | None, typer.Argument(help="App services to stop (default: all)")
        ] = None,
    ) -> None:
        """Stop this instance's app stack (use --all to also stop shared infra)."""
        instance = _get_instance(ctx)
        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance) + ["down"] + (services or [])
        console.print(f"[dim]Stopping app stack (instance {instance})...[/dim]")
        result = run_command(cmd, env=env)
        if not result or result.returncode != 0:
            console.print("[red]Failed to stop app stack[/red]")
            raise typer.Exit(1)
        console.print("[green]App stack stopped[/green]")

        if all_:
            console.print("[dim]Stopping shared infra...[/dim]")
            shared = _shared_compose_cmd(monitoring=True) + ["down"]
            result = run_command(shared)
            if not result or result.returncode != 0:
                console.print("[red]Failed to stop shared infra[/red]")
                raise typer.Exit(1)
            console.print("[green]Shared infra stopped[/green]")
        else:
            console.print(
                "[dim]Shared infra still running — `dev docker down --all` to stop it.[/dim]"
            )

    @docker_app.command("logs")
    def docker_logs(
        ctx: typer.Context,
        follow: Annotated[
            bool, typer.Option("--follow", "-f", help="Follow log output")
        ] = True,
        service: Annotated[
            str | None,
            typer.Argument(help="Service to tail (auto-routed to shared/app project)"),
        ] = None,
    ) -> None:
        """Tail logs for an app or shared service (auto-routes by service name)."""
        instance = _get_instance(ctx)
        _ensure_env_file()
        cmd, env = _route(service, instance)
        cmd = cmd + ["logs"]
        if follow:
            cmd.append("-f")
        if service:
            cmd.append(service)
        full_env = {**os.environ, **env}
        os.execvpe(cmd[0], cmd, full_env)

    @docker_app.command("ps")
    def docker_ps(ctx: typer.Context) -> None:
        """List running containers — both shared infra and this instance's app stack."""
        instance = _get_instance(ctx)
        _ensure_env_file()
        console.print(f"[bold]Shared ({SHARED_PROJECT_NAME})[/bold]")
        run_command(_shared_compose_cmd(monitoring=True) + ["ps"])
        console.print(f"\n[bold]App ({app_project(instance)})[/bold]")
        run_command(
            _build_compose_cmd(instance) + ["ps"], env=_build_compose_env(instance)
        )

    @docker_app.command("restart")
    def docker_restart(
        ctx: typer.Context,
        services: Annotated[
            list[str] | None,
            typer.Argument(help="Services to restart — auto-routed by name"),
        ] = None,
    ) -> None:
        """Restart services (auto-routes by name; mixing app + shared services is not supported)."""
        instance = _get_instance(ctx)
        _ensure_env_file()
        # Determine routing from the first service; require homogeneous targets.
        first = (services or [None])[0]
        if services and not all(
            (s in SHARED_SERVICES) == (first in SHARED_SERVICES) for s in services
        ):
            console.print(
                "[red]Cannot restart shared and app services in one call. Run them separately.[/red]"
            )
            raise typer.Exit(1)
        cmd, env = _route(first, instance)
        cmd = cmd + ["restart"] + (services or [])
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
            list[str] | None,
            typer.Argument(
                help="Services to build (app services only — shared use upstream images)"
            ),
        ] = None,
    ) -> None:
        """Build/rebuild this instance's app images."""
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
            str, typer.Argument(help="Service to shell into (app or shared)")
        ],
    ) -> None:
        """Open a /bin/bash shell in any service's container (use `exec` for one-off commands)."""
        instance = _get_instance(ctx)
        _ensure_env_file()
        cmd, env = _route(service, instance)
        cmd = cmd + ["exec", service, "/bin/bash"]
        console.print(f"[dim]Opening shell in {service}...[/dim]")
        full_env = {**os.environ, **env}
        os.execvpe(cmd[0], cmd, full_env)

    @docker_app.command(
        "exec",
        context_settings={"allow_extra_args": True, "ignore_unknown_options": True},
    )
    def docker_exec(
        ctx: typer.Context,
        service: Annotated[
            str,
            typer.Argument(
                help="Service to exec in (auto-routed to shared/app project)"
            ),
        ],
    ) -> None:
        """Run a command in any service's container.

        Examples:
          dev docker exec db psql -U polar -l
          dev docker exec redis redis-cli -n 1 dbsize
          dev docker exec api uv run alembic current
        """
        instance = _get_instance(ctx)
        _ensure_env_file()
        cmd, env = _route(service, instance)
        extra = ctx.args or ["/bin/sh"]
        cmd = cmd + ["exec", service, *extra]
        full_env = {**os.environ, **env}
        os.execvpe(cmd[0], cmd, full_env)

    @docker_app.command("cleanup")
    def docker_cleanup(
        ctx: typer.Context,
        all_: Annotated[
            bool,
            typer.Option(
                "--all",
                help="Also wipe shared infra volumes (DESTROYS data for ALL instances)",
            ),
        ] = False,
        force: Annotated[
            bool, typer.Option("--force", help="Skip confirmation")
        ] = False,
    ) -> None:
        """Remove this instance's app containers and volumes (use --all to nuke shared infra too)."""
        instance = _get_instance(ctx)
        if not force:
            if all_:
                console.print(
                    "[red bold]This destroys ALL postgres data, MinIO objects, Tinybird events, prometheus/grafana state.[/red bold]"
                )
                console.print(
                    "[red]Every instance on this machine will be wiped.[/red]"
                )
                if not typer.confirm("Are you absolutely sure?"):
                    raise typer.Abort()
            else:
                console.print(
                    "[yellow]This will remove this instance's api/worker/web containers and their build/cache volumes.[/yellow]"
                )
                console.print(
                    "[dim]Shared infra (postgres, redis, minio, tinybird) is left untouched. Use --all to wipe that too.[/dim]"
                )
                if not typer.confirm("Continue?"):
                    raise typer.Abort()

        _ensure_env_file()
        env = _build_compose_env(instance)
        cmd = _build_compose_cmd(instance) + ["down", "-v", "--remove-orphans"]
        console.print(f"[dim]Cleaning up app stack (instance {instance})...[/dim]")
        result = run_command(cmd, env=env)
        if not result or result.returncode != 0:
            console.print("[red]Cleanup failed[/red]")
            raise typer.Exit(1)
        console.print("[green]App stack cleaned up[/green]")

        if all_:
            console.print("[dim]Wiping shared infra volumes...[/dim]")
            shared = _shared_compose_cmd(monitoring=True) + [
                "down",
                "-v",
                "--remove-orphans",
            ]
            result = run_command(shared)
            if not result or result.returncode != 0:
                console.print("[red]Shared cleanup failed[/red]")
                raise typer.Exit(1)
            console.print("[green]Shared infra wiped[/green]")

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
        console.print(
            f"[dim]Ports: API={8000 + offset}, Web={3000 + offset}, DB=5432 (shared)[/dim]"
        )
        console.print(
            f"[dim]Database: {db_name(instance)}, Redis DB: {redis_db(instance)}, "
            f"Buckets: {s3_bucket(instance)}, {s3_public_bucket(instance)}[/dim]"
        )

    @docker_app.command("clear-instance")
    def docker_clear_instance() -> None:
        """Remove stored instance number (back to auto-detect)."""
        if _clear_stored_instance():
            console.print("[green]Cleared stored instance from .env.docker[/green]")
        else:
            console.print("[dim]No stored instance to clear[/dim]")
