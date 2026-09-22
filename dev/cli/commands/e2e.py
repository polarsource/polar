"""Set up what the Stagehand E2E checkout test needs on the local stack.

The test checks out a free trial through a checkout link and cancels it, so it
needs a product with a trial, an organization that allows repeated trials, and
an OpenAI key for Stagehand. All of that is per machine, so the values land in
the central secrets file and flow into clients/apps/web/.env.local from there.
"""

import subprocess
import urllib.error
import urllib.request
from typing import Annotated

import typer
from dotenv import dotenv_values
from rich.panel import Panel
from rich.table import Table

from shared import (
    CLIENTS_DIR,
    ROOT_DIR,
    SERVER_DIR,
    console,
    read_secrets,
    run_command,
    step_failed,
    step_spinner,
    step_status,
    update_secrets,
)

WEB_ENV_FILE = CLIENTS_DIR / "apps" / "web" / ".env.local"
OPENAI_KEYS_URL = "https://platform.openai.com/api-keys"


def _script(*args: str) -> subprocess.CompletedProcess | None:
    return run_command(
        ["uv", "run", "python", "-m", "scripts.e2e_setup", *args],
        cwd=SERVER_DIR,
        capture=True,
    )


def _pick_org(slug: str | None) -> str:
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


def _has_openai_key() -> bool:
    if read_secrets().get("OPENAI_API_KEY"):
        return True
    return bool(dotenv_values(WEB_ENV_FILE).get("OPENAI_API_KEY")) if WEB_ENV_FILE.exists() else False


def _openai_key_rejected(key: str) -> bool:
    request = urllib.request.Request(
        "https://api.openai.com/v1/models", headers={"Authorization": f"Bearer {key}"}
    )
    try:
        urllib.request.urlopen(request, timeout=10)
    except urllib.error.HTTPError as error:
        return error.code == 401
    except urllib.error.URLError:
        return False
    return False


def _prompt_openai_key() -> str | None:
    console.print()
    console.print("  Stagehand drives the browser with an OpenAI model, so the test needs an API key.")
    console.print(f"  Create one at [link={OPENAI_KEYS_URL}]{OPENAI_KEYS_URL}[/link]")
    key = typer.prompt(
        "  Paste it here (leave empty to add it later)",
        default="",
        hide_input=True,
        show_default=False,
    ).strip()
    if key and _openai_key_rejected(key):
        console.print("  [red]OpenAI rejected that key, so it was not saved.[/red]")
        return None
    return key or None


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
        """Create the trial product and checkout link the E2E test needs, and point the test at them."""
        console.print("\n[bold blue]E2E setup[/bold blue]\n")
        slug = _pick_org(org)

        with step_spinner(f"Preparing {slug}..."):
            result = _script("setup", "--org", slug)
        if not result or result.returncode != 0:
            step_failed(f"Preparing {slug}", "failed", result)
            raise typer.Exit(1)
        values = dict(
            line.split("=", 1) for line in result.stdout.splitlines() if "=" in line
        )
        step_status(True, f"{values['PRODUCT_NAME']} product with a 7-day trial in {slug}")
        step_status(True, "Repeated trials allowed", "prevent_trial_abuse off")
        step_status(True, "Checkout link", values["E2E_CHECKOUT_LINK"])

        secrets = {"E2E_CHECKOUT_LINK": values["E2E_CHECKOUT_LINK"]}
        if not _has_openai_key():
            key = _prompt_openai_key()
            if key:
                secrets["OPENAI_API_KEY"] = key
        update_secrets(secrets)
        run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)
        step_status(True, "clients/apps/web/.env.local", ", ".join(secrets))
        if not _has_openai_key():
            console.print(
                f"  [yellow]No OPENAI_API_KEY yet: create one at {OPENAI_KEYS_URL}, then rerun dev e2e setup[/yellow]"
            )

        next_steps = Table(show_header=False, box=None, padding=(0, 2))
        next_steps.add_column(style="bold cyan")
        next_steps.add_column(style="dim")
        if not _stripe_listener_running():
            next_steps.add_row("dev stripe --listen", "Forward Stripe webhooks, the trial needs them")
        next_steps.add_row("pnpm --filter web test:e2e", "Run the test, from clients/")
        console.print()
        console.print(Panel(next_steps, title="[bold green]Next[/bold green]", border_style="green", padding=(1, 2)))
        console.print()
