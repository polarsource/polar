"""Show comprehensive environment status."""

import typer

from shared import (
    CLIENTS_DIR,
    DEFAULT_API_PORT,
    DEFAULT_DB_PORT,
    DEFAULT_MINIO_PORT,
    DEFAULT_REDIS_PORT,
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
        }

        for service_key, (name, port) in services.items():
            running = any(
                service_key in container_name and is_running
                for container_name, is_running in docker_status.items()
            )
            if running:
                step_status(True, name, f"running (port {port})")
            else:
                step_status(False, name, "not running")

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
