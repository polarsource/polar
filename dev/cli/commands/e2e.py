"""Run the local end-to-end (Playwright) test suite against this worktree's stack."""

import importlib.util
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Annotated

import typer

from shared import (
    CLIENTS_DIR,
    ROOT_DIR,
    check_node_modules_exists,
    console,
    run_command,
)

# Reuse the docker command's instance detection + port scheme (single source of
# truth) rather than re-deriving the per-worktree ports here.
_DOCKER_PATH = Path(__file__).parent / "docker.py"
_spec = importlib.util.spec_from_file_location("_e2e_docker", _DOCKER_PATH)
_docker = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_docker)

WEB_DIR = CLIENTS_DIR / "apps" / "web"
DEV_CLI = ROOT_DIR / "dev" / "cli" / "dev"


def _api_healthy(api_url: str) -> bool:
    try:
        with urllib.request.urlopen(f"{api_url}/healthz", timeout=2) as resp:
            return resp.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def _ensure_deps() -> None:
    """Install host JS deps (Playwright runs on the host) if node_modules is missing.

    `dev docker up` builds deps inside the containers, not on the host, so a
    worktree set up only that way has no `clients/node_modules`.
    """
    if not check_node_modules_exists():
        console.print("[dim]node_modules missing — installing JS deps (pnpm install)...[/dim]")
        run_command(["pnpm", "install"], cwd=CLIENTS_DIR)


def _ensure_browser() -> None:
    """Install the Playwright chromium browser if missing (idempotent, ~instant when present)."""
    run_command(
        ["pnpm", "--filter", "web", "exec", "playwright", "install", "chromium"],
        cwd=CLIENTS_DIR,
        capture=True,
    )


def _ensure_stack(api_url: str) -> bool:
    """Start the dev-docker stack if the API isn't answering, then wait for health."""
    if _api_healthy(api_url):
        return True
    console.print("[dim]Stack not up — starting it (dev docker up)...[/dim]")
    run_command([str(DEV_CLI), "docker", "up", "-d"])
    for _ in range(60):
        if _api_healthy(api_url):
            return True
        time.sleep(5)
    return False


def _ensure_seeded(instance: int) -> None:
    """Seed the database if the admin org isn't present yet."""
    result = run_command(
        [
            "docker", "exec", f"{_docker.SHARED_PROJECT_NAME}-db-1",
            "psql", "-U", "polar", "-d", _docker.db_name(instance), "-tAc",
            "select 1 from organizations where slug='admin-org' limit 1",
        ],
        capture=True,
    )
    if not (result and result.returncode == 0 and result.stdout.strip()):
        console.print("[dim]Database not seeded — seeding (dev seed)...[/dim]")
        run_command([str(DEV_CLI), "seed"])


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command(
        context_settings={"allow_extra_args": True, "ignore_unknown_options": True}
    )
    def e2e(
        ctx: typer.Context,
        report: Annotated[
            bool,
            typer.Option("--report", "-r", help="Open the HTML report when the run finishes."),
        ] = False,
        screenshots: Annotated[
            bool,
            typer.Option(
                "--screenshots", "-s", help="Capture a screenshot + video for every test, not just failures."
            ),
        ] = False,
    ) -> None:
        """Run the Playwright E2E suite against this worktree's dev-docker stack.

        Bootstraps everything it needs: installs JS deps + the Playwright browser,
        brings the stack up, and seeds the DB if necessary. Extra args pass through
        to Playwright, e.g. `dev e2e signup --headed --workers=2`.
        """
        instance, source = _docker._detect_instance()
        web_url = f"http://localhost:{_docker.web_port(instance)}"
        api_url = f"http://localhost:{_docker.api_port(instance)}"

        console.print(
            f"\n[bold blue]E2E[/bold blue] instance [bold]{instance}[/bold] "
            f"([dim]{source}[/dim])  web={web_url}  api={api_url}\n"
        )

        _ensure_deps()
        _ensure_browser()
        if not _ensure_stack(api_url):
            console.print(
                f"[red]API at {api_url} did not become healthy after starting the stack.[/red] "
                "Check [bold]dev docker logs api[/bold].\n"
            )
            raise typer.Exit(1)
        _ensure_seeded(instance)

        env = {
            "E2E_INSTANCE": str(instance),
            "E2E_WEB_URL": web_url,
            "E2E_API_URL": api_url,
        }
        if screenshots:
            env["E2E_SCREENSHOTS"] = "1"

        cmd = ["pnpm", "--filter", "web", "exec", "playwright", "test", *ctx.args]
        result = run_command(cmd, cwd=CLIENTS_DIR, env=env)
        code = result.returncode if result else 1

        if report:
            run_command(["pnpm", "exec", "playwright", "show-report"], cwd=WEB_DIR)
        else:
            console.print(
                "\n[dim]HTML report:[/dim] "
                "[bold]dev e2e --report[/bold]  "
                "[dim](or: cd clients/apps/web && pnpm exec playwright show-report)[/dim]"
            )

        raise typer.Exit(code)
