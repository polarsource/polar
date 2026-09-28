"""Set up what the Playwright E2E tests need on the local stack.

The tests create their own products and checkouts through the API, so they need
an organization access token and an organization that allows repeated trials.
The token is per machine, so it lands in the central secrets file and flows into
clients/apps/web/.env.local from there.
"""

import subprocess
from typing import Annotated

import typer
from rich.panel import Panel
from rich.table import Table

from shared import (
    CLIENTS_DIR,
    ROOT_DIR,
    SERVER_DIR,
    console,
    gradient,
    gradient_title,
    run_command,
    step_failed,
    step_spinner,
    step_status,
    update_secrets,
)


def _script(*args: str) -> subprocess.CompletedProcess | None:
    return run_command(
        ["uv", "run", "python", "-m", "scripts.e2e_setup", *args],
        cwd=SERVER_DIR,
        capture=True,
    )


def _pick_org(slug: str | None) -> str:
    with step_spinner("Looking up organizations that can take payments..."):
        result = _script("list-orgs")
    if not result or result.returncode != 0:
        step_failed("Listing organizations", "failed", result)
        raise typer.Exit(1)

    orgs = [line.split("\t", 1) for line in result.stdout.splitlines() if "\t" in line]
    if slug:
        if slug not in {org_slug for org_slug, _ in orgs}:
            console.print(f"[red]Organization '{slug}' cannot take payments.[/red]")
            console.print(f"[dim]Run [bold]dev enable-payments {slug}[/bold] first.[/dim]")
            raise typer.Exit(1)
        return slug
    if not orgs:
        console.print("[red]No organization can take payments yet.[/red]")
        console.print("[dim]Run [bold]dev seed[/bold] or [bold]dev enable-payments <slug>[/bold] first.[/dim]")
        raise typer.Exit(1)
    if len(orgs) == 1:
        return orgs[0][0]

    from InquirerPy import inquirer

    return inquirer.select(
        message="Which organization should the E2E test check out from?",
        choices=[{"name": f"{org_slug}  ({name})", "value": org_slug} for org_slug, name in orgs],
    ).execute()


def _intro() -> None:
    title = gradient("Polar E2E")
    title.append("\nPlaywright checkout tests against your local stack", style="dim")
    title.justify = "center"
    console.print()
    console.print(Panel(title, border_style="blue", padding=(1, 4)))
    console.print(
        "[dim]Creates an organization token, allows repeated trials, "
        "installs Chromium and writes it all into .env.local[/dim]\n"
    )


def _stripe_listener_running() -> bool:
    result = run_command(["pgrep", "-f", "stripe listen"], capture=True)
    return result is not None and result.returncode == 0


def register(app: typer.Typer, prompt_setup: callable) -> None:
    e2e_app = typer.Typer(help="End-to-end test helpers")
    app.add_typer(e2e_app, name="e2e")

    @e2e_app.command("setup")
    def setup(
        org: Annotated[
            str | None,
            typer.Option("--org", help="Organization slug (prompted when there are several)"),
        ] = None,
    ) -> None:
        """Create an organization token for the E2E tests and allow repeated trials."""
        _intro()
        slug = _pick_org(org)

        with step_spinner(f"Preparing {slug}..."):
            result = _script("setup", "--org", slug)
        if not result or result.returncode != 0:
            step_failed(f"Preparing {slug}", "failed", result)
            raise typer.Exit(1)
        values = dict(
            line.split("=", 1) for line in result.stdout.splitlines() if "=" in line
        )
        step_status(True, "Organization token", f"created for {slug}, the tests create products and checkouts with it")
        step_status(True, "Repeated trials", f"prevent_trial_abuse off for {slug}")

        with step_spinner("Installing Chromium for Playwright..."):
            result = run_command(
                ["pnpm", "--filter", "web", "exec", "playwright", "install", "chromium"],
                cwd=CLIENTS_DIR,
                capture=True,
            )
        if not result or result.returncode != 0:
            step_failed("Installing Chromium", "failed", result)
            raise typer.Exit(1)
        step_status(True, "Chromium", "Playwright's own build")

        secrets = {"E2E_ORG_TOKEN": values["E2E_ORG_TOKEN"]}
        update_secrets(secrets)
        run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)
        step_status(True, ".env.local", "E2E_ORG_TOKEN written for clients/apps/web")

        next_steps = Table(show_header=False, box=None, padding=(0, 2))
        next_steps.add_column(style="bold cyan")
        next_steps.add_column(style="dim")
        if not _stripe_listener_running():
            next_steps.add_row("dev stripe --listen", "Forward Stripe webhooks, the trial needs them")
        next_steps.add_row("dev e2e run", "Run the tests")
        next_steps.add_row("dev e2e run --headed", "Run the tests with a visible browser")
        console.print()
        console.print(
            Panel(next_steps, title=gradient_title("Next"), border_style="blue", padding=(1, 2))
        )
        console.print()

    @e2e_app.command("run")
    def run(
        pattern: Annotated[
            str | None,
            typer.Argument(help="Only run test files whose path contains this text"),
        ] = None,
        headed: Annotated[
            bool,
            typer.Option("--headed", help="Show the browser while the tests run"),
        ] = False,
    ) -> None:
        """Run the E2E tests against the local stack."""
        script = "test:e2e:headed" if headed else "test:e2e"
        result = run_command(
            ["pnpm", "--filter", "web", script, *([pattern] if pattern else [])],
            cwd=CLIENTS_DIR,
            capture=False,
        )
        raise typer.Exit(result.returncode if result else 1)
