"""Modular database seeding (work in progress, will replace `dev seed`).

Three entry points:
  - Basic   the native multi-org + Polar-self demo preset (`scripts.seeds demo`).
  - Custom  the modular flow; its menu is generated from the backend's
            `python -m scripts.seeds describe`, so options always match what the
            backend can build.
  - Reset   recreate the database, then Basic.
"""

import json
import sys
import tempfile
from pathlib import Path

import typer
from rich.panel import Panel
from rich.table import Table

from shared import (
    ROOT_DIR,
    SECRETS_FILE,
    SERVER_DIR,
    console,
    run_command,
    step_spinner,
    step_status,
)

DEFAULT_OWNER = "admin@polar.sh"


def _select_kind() -> str:
    from InquirerPy import inquirer
    from InquirerPy.base.control import Choice

    return inquirer.select(
        message="What do you want to do?",
        choices=[
            Choice(value="basic", name="Basic    the full demo seed (everything dev seed does today)"),
            Choice(value="custom", name="Custom   create a new org and pick exactly what to include"),
            Choice(value="reset", name="Reset    recreate the database, then the full demo seed"),
        ],
        default="basic",
    ).execute()


# --- Basic / Reset: native multi-org + Polar-self preset ---


def _update_secrets_file(key: str, value: str) -> None:
    SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing = {}
    if SECRETS_FILE.exists():
        for line in SECRETS_FILE.read_text().split("\n"):
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                existing[k.strip()] = v.strip().strip("\"'")

    existing[key] = value

    with open(SECRETS_FILE, "w") as f:
        f.write("# Polar Development Secrets\n")
        f.write("# Shared across Git worktrees\n\n")
        for k, v in existing.items():
            delimiter = "'" if '"' in v else '"'
            f.write(f"{k}={delimiter}{v}{delimiter}\n")


def _write_polar_self_env(stdout: str) -> None:
    try:
        env = json.loads(stdout.strip().splitlines()[-1]).get("env", {})
    except (ValueError, IndexError):
        env = {}
    if not env:
        return
    for key, value in env.items():
        _update_secrets_file(key, value)
    run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)
    console.print("[dim]Configured Polar self-integration in .env[/dim]")


def _show_basic_login_info() -> None:
    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column(style="dim")
    table.add_column(style="bold")
    table.add_row("Email", "admin@polar.sh")
    table.add_row("OTP", "Check the terminal running dev api")
    table.add_row("Note", "This account can access all seeded organizations")

    console.print()
    console.print(
        Panel(
            table,
            title="[bold green]Full demo seeded![/bold green]",
            subtitle="[dim]Log in with[/dim]",
            border_style="green",
            padding=(1, 2),
        )
    )
    console.print()


def _run_basic() -> bool:
    console.print("[bold blue]Seeding the full demo dataset...[/bold blue]")
    console.print("[dim]This usually takes a few minutes.[/dim]\n")

    with step_spinner("Seeding database..."):
        result = run_command(
            ["uv", "run", "python", "-m", "scripts.seeds", "demo"],
            cwd=SERVER_DIR,
            capture=True,
        )

    if not result or result.returncode != 0:
        stderr = (result.stderr or "") if result else ""
        if "already exists" in stderr:
            console.print(
                Panel(
                    "[dim]Database already seeded. Choose [bold]Reset[/bold] to recreate it first.[/dim]",
                    title="[bold yellow]Already seeded[/bold yellow]",
                    border_style="yellow",
                    padding=(1, 2),
                )
            )
            return True
        if stderr:
            console.print(stderr.strip())
        step_status(False, "Seeding failed")
        return False

    step_status(True, "Seed data loaded")
    _write_polar_self_env(result.stdout)
    _show_basic_login_info()
    return True


def _run_reset() -> bool:
    from InquirerPy import inquirer

    console.print(
        "[yellow]This will delete all local database data before reseeding.[/yellow]"
    )
    if not inquirer.confirm(message="Continue?", default=False).execute():
        raise typer.Abort()
    console.print()

    with step_spinner("Recreating database..."):
        result = run_command(
            ["uv", "run", "task", "db_recreate"], cwd=SERVER_DIR, capture=True
        )

    if not result or result.returncode != 0:
        if result and result.stderr:
            console.print(result.stderr.strip())
        step_status(False, "Database recreate failed")
        return False

    step_status(True, "Database recreated")
    return _run_basic()


# --- Custom: the modular flow ---


_DESCRIBE_CACHE = Path(tempfile.gettempdir()) / "polar_seeds_describe.json"


def _describe() -> list[dict]:
    seeds_dir = SERVER_DIR / "scripts" / "seeds"
    try:
        newest = max((f.stat().st_mtime for f in seeds_dir.glob("*.py")), default=0.0)
        if _DESCRIBE_CACHE.exists() and _DESCRIBE_CACHE.stat().st_mtime >= newest:
            return json.loads(_DESCRIBE_CACHE.read_text())
    except Exception:
        pass

    with step_spinner("Loading seed options..."):
        result = run_command(
            ["uv", "run", "python", "-m", "scripts.seeds", "describe"],
            cwd=SERVER_DIR,
            capture=True,
        )
    if not result or result.returncode != 0:
        if result and result.stderr:
            console.print(result.stderr.strip())
        return []

    data = json.loads(result.stdout.strip().splitlines()[-1])
    try:
        _DESCRIBE_CACHE.write_text(json.dumps(data))
    except Exception:
        pass
    return data


def _prompt_slug() -> str:
    from InquirerPy import inquirer

    return inquirer.text(message="Organization slug", default="acme-test").execute()


def _prompt_owner() -> str:
    from InquirerPy import inquirer

    return inquirer.text(
        message="Add the org to which user?", default=DEFAULT_OWNER
    ).execute()


def _include_label(component: dict, by_key: dict) -> str:
    requires = component.get("requires") or []
    if not requires:
        return component["label"]
    deps = ", ".join(by_key[key]["label"].lower() for key in requires if key in by_key)
    return f"{component['label']}  (needs {deps})"


def _prompt_includes(components: list[dict]) -> list[str]:
    from InquirerPy import inquirer
    from InquirerPy.base.control import Choice

    by_key = {c["key"]: c for c in components}
    return inquirer.checkbox(
        message="What should it include?  Dependencies are pulled in automatically.",
        choices=[
            Choice(
                value=c["key"],
                name=_include_label(c, by_key),
                enabled=c["default_on"],
            )
            for c in components
        ],
        instruction="↑/↓ move · space toggle · enter confirm",
        transformer=lambda result: f"{len(result)} selected",
    ).execute()


def _prompt_variant(component: dict) -> str:
    from InquirerPy import inquirer
    from InquirerPy.base.control import Choice

    variants = component["variants"]
    return inquirer.select(
        message=f"{component['label']} — which variant?",
        choices=[Choice(value=v["key"], name=v["label"]) for v in variants],
        default=variants[0]["key"],
    ).execute()


def _show_result(slug: str, owner: str, summary: list[str]) -> None:
    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column(style="dim")
    table.add_column(style="bold")
    table.add_row("Slug", slug)
    table.add_row("Owner", owner)
    for line in summary:
        table.add_row("Created", line)

    console.print()
    console.print(
        Panel(
            table,
            title="[bold green]Org seeded, wowza![/bold green]",
            border_style="green",
            padding=(1, 2),
        )
    )
    console.print()


def _show_next_steps(slug: str, owner: str) -> None:
    steps = Table(show_header=False, box=None, padding=(0, 2))
    steps.add_column(style="bold cyan")
    steps.add_column()
    steps.add_row("1.", "Make sure services are running — [bold]dev start[/bold]")
    steps.add_row("2.", f"Log in as [bold]{owner}[/bold] at http://127.0.0.1:3000")
    steps.add_row("", "[dim]Grab the OTP from the terminal running [bold]dev api[/bold][/dim]")
    steps.add_row("3.", f"Open the dashboard — [bold]http://127.0.0.1:3000/dashboard/{slug}[/bold]")

    console.print(
        Panel(
            steps,
            title="[bold blue]Next steps[/bold blue]",
            border_style="blue",
            padding=(1, 2),
        )
    )
    console.print()


def _run_build(slug: str, owner: str, spec_components: dict) -> dict | None:
    spec = {"slug": slug, "owner": owner, "components": spec_components}
    with step_spinner("Seeding..."):
        result = run_command(
            ["uv", "run", "python", "-m", "scripts.seeds", "build", "--spec", json.dumps(spec)],
            cwd=SERVER_DIR,
            capture=True,
        )

    if not result or result.returncode != 0:
        if result and result.stderr:
            console.print(result.stderr.strip())
        step_status(False, "Seeding failed")
        return None

    step_status(True, "Seed data loaded")
    payload = {}
    try:
        payload = json.loads(result.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        pass
    _show_result(slug, payload.get("owner", owner), payload.get("summary", []))
    return payload


def _scenarios() -> list[dict]:
    result = run_command(
        ["uv", "run", "python", "-m", "scripts.seeds", "scenarios"],
        cwd=SERVER_DIR,
        capture=True,
    )
    if not result or result.returncode != 0:
        if result and result.stderr:
            console.print(result.stderr.strip())
        return []
    return json.loads(result.stdout.strip().splitlines()[-1])


def _prompt_scenario(scenarios: list[dict]) -> str:
    from InquirerPy import inquirer
    from InquirerPy.base.control import Choice
    from InquirerPy.separator import Separator

    width = max(len(s["label"]) for s in scenarios)
    choices: list = [
        Choice(value=s["key"], name=f"{s['label'].ljust(width)}   {s['hint']}")
        for s in scenarios
    ]
    choices.append(Separator())
    choices.append(Choice(value="__advanced__", name="Advanced — pick entities yourself"))
    return inquirer.select(
        message="What are you working on?",
        choices=choices,
        default=scenarios[0]["key"],
    ).execute()


def _run_scenario(key: str, slug: str, owner: str) -> dict | None:
    with step_spinner("Seeding..."):
        result = run_command(
            ["uv", "run", "python", "-m", "scripts.seeds", "build",
             "--scenario", key, "--slug", slug, "--owner", owner],
            cwd=SERVER_DIR,
            capture=True,
        )
    if not result or result.returncode != 0:
        if result and result.stderr:
            console.print(result.stderr.strip())
        step_status(False, "Seeding failed")
        return None

    step_status(True, "Seed data loaded")
    payload = {}
    try:
        payload = json.loads(result.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        pass
    _show_result(slug, payload.get("owner", owner), payload.get("summary", []))
    return payload


def _run_advanced() -> None:
    components = _describe()
    if not components:
        console.print("[red]Could not load seed components from the backend.[/red]")
        raise typer.Exit(1)

    slug = _prompt_slug()
    owner = _prompt_owner()
    selected = _prompt_includes(components)

    by_key = {c["key"]: c for c in components}
    spec_components: dict = {}
    for key in selected:
        component = by_key[key]
        spec_components[key] = _prompt_variant(component) if component["variants"] else True

    payload = _run_build(slug, owner, spec_components)
    if payload is None:
        raise typer.Exit(1)
    _show_next_steps(slug, payload.get("owner", owner))


def _run_custom() -> None:
    scenarios = _scenarios()
    if not scenarios:
        console.print("[red]Could not load scenarios from the backend.[/red]")
        raise typer.Exit(1)

    choice = _prompt_scenario(scenarios)
    if choice == "__advanced__":
        _run_advanced()
        return

    slug = _prompt_slug()
    owner = _prompt_owner()
    payload = _run_scenario(choice, slug, owner)
    if payload is None:
        raise typer.Exit(1)
    _show_next_steps(slug, payload.get("owner", owner))


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def seed2(
        scenario: str = typer.Argument(
            None,
            help="Seed a scenario non-interactively: billing, metered, seats, "
            "benefits, backoffice, empty, everything.",
        ),
        slug: str = typer.Option("acme-test", "--slug", help="Org slug (with a scenario)"),
        owner: str = typer.Option(
            DEFAULT_OWNER, "--owner", help="Owner email (with a scenario)"
        ),
    ) -> None:
        """Seed the database.

        No args → interactive (basic / custom / reset). Pass a scenario name to
        seed it non-interactively, e.g. `dev seed2 seats --slug my-org`.
        """
        console.print()

        if scenario:
            payload = _run_scenario(scenario, slug, owner)
            if payload is None:
                raise typer.Exit(1)
            _show_next_steps(slug, payload.get("owner", owner))
            return

        if not sys.stdin.isatty():
            console.print(
                "[red]dev seed2 is interactive — run it in a terminal, or pass a scenario name.[/red]"
            )
            raise typer.Exit(1)

        kind = _select_kind()
        if kind == "custom":
            _run_custom()
        elif kind == "reset":
            if not _run_reset():
                raise typer.Exit(1)
        elif not _run_basic():
            raise typer.Exit(1)
