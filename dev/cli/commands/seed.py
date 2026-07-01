"""Seed the database with sample data for development."""

import sys

import typer
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

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

INCLUDE_OPTIONS = [
    ("products", "Products"),
    ("customers", "Customers"),
    ("orders", "Orders & subscriptions"),
    ("cost_insights", "Cost insights"),
]

INCLUDE_LABEL = {
    "products": "products",
    "customers": "customers",
    "orders": "orders & subscriptions",
    "cost_insights": "cost insights",
}

PRODUCT_VARIANTS = [
    ("mix", "A mix of products"),
    ("subscriptions", "Subscriptions only"),
    ("seats", "Seats only (per-seat pricing)"),
    ("one_time", "One-time only"),
]

ORDER_VARIANTS = [
    ("mix", "A realistic mix (trials, cancellations, refunds, disputes)"),
    ("successful", "Successful only (clean active subscriptions, paid orders)"),
]

COST_VARIANTS = [
    ("mix", "A mix of LLM and infrastructure"),
    ("llm", "LLM usage only (model token costs)"),
    ("infra", "Infrastructure only (storage, compute)"),
]

GROUP_VARIANTS = {
    "products": PRODUCT_VARIANTS,
    "orders": ORDER_VARIANTS,
    "cost_insights": COST_VARIANTS,
}

VARIANT_PROMPTS = {
    "products": "What kind of products?",
    "orders": "Which orders?",
    "cost_insights": "What kind of cost insights?",
}

DEFAULT_INCLUDES = {"products", "customers", "orders"}

VARIANT_LABEL = {
    "products": {
        "mix": "mixed",
        "subscriptions": "subscriptions only",
        "seats": "seats only",
        "one_time": "one-time only",
    },
    "orders": {
        "mix": "realistic mix",
        "successful": "successful only",
    },
    "cost_insights": {
        "mix": "LLM + infra",
        "llm": "LLM only",
        "infra": "infra only",
    },
}


def _update_secrets_file(key: str, value: str) -> None:
    """Update a key in the central secrets file."""
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


def _configure_polar_self_integration() -> None:
    """Query the seeded admin org and configure Polar self-integration env vars."""
    result = run_command(
        ["uv", "run", "python", "-m", "scripts.seeds_load", "polar-self-env"],
        cwd=SERVER_DIR,
        capture=True,
    )
    if not result or result.returncode != 0:
        return

    for line in result.stdout.strip().split("\n"):
        if "=" in line:
            key, value = line.split("=", 1)
            _update_secrets_file(key.strip(), value.strip())

    run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)
    console.print("[dim]Configured Polar self-integration in .env[/dim]")


def _print_command_output(result: object) -> None:
    stdout = getattr(result, "stdout", "") or ""
    stderr = getattr(result, "stderr", "") or ""

    if stdout.strip():
        console.print(stdout.strip())
    if stderr.strip():
        console.print(stderr.strip())


def _print_info(message: str) -> None:
    console.print(f"[dim]{message}[/dim]")


def _confirm(message: str, *, default: bool = False) -> bool:
    suffix = "[Y/n]" if default else "[y/N]"
    console.print(Text(f"{message} {suffix}:"), end=" ")
    response = input().strip().lower()
    if not response:
        return default
    return response in {"y", "yes"}


def _print_seeded_login_info(new_org: str | None = None) -> None:
    login_info = Table(show_header=False, box=None, padding=(0, 2))
    login_info.add_column(style="dim")
    login_info.add_column(style="bold")
    login_info.add_row("Email", f"{new_org}@polar.sh" if new_org else "admin@polar.sh")
    login_info.add_row("OTP", "Check the terminal running dev api")
    if not new_org:
        login_info.add_row(
            "Note", "This account has access to multiple seeded organizations"
        )

    console.print()
    console.print(
        Panel(
            login_info,
            title="[bold green]Organization Seeded![/bold green]"
            if new_org
            else "[bold green]Default Seed Loaded![/bold green]",
            subtitle="[dim]Log in with[/dim]"
            if new_org
            else "[dim]Use this account to access the seeded organizations[/dim]",
            border_style="green",
            padding=(1, 2),
        )
    )
    console.print()


def _poc_select_kind() -> str:
    from InquirerPy import inquirer
    from InquirerPy.base.control import Choice

    return inquirer.select(
        message="What kind of seed do you want?",
        choices=[
            Choice(
                value="full",
                name="Full demo        multiple orgs · products · customers · orders · insights",
            ),
            Choice(
                value="custom",
                name="Custom org       pick a user and exactly what to include",
            ),
            Choice(
                value="reset",
                name="Reset & reseed   wipe the database, then full demo",
            ),
        ],
        default="full",
    ).execute()


def _poc_prompt_owner() -> str:
    from InquirerPy import inquirer

    return inquirer.text(
        message="Add the org to which user?",
        default=DEFAULT_OWNER,
    ).execute()


def _poc_prompt_slug() -> str:
    from InquirerPy import inquirer

    return inquirer.text(message="Organization slug", default="acme-test").execute()


def _poc_prompt_includes() -> list[str]:
    from InquirerPy import inquirer
    from InquirerPy.base.control import Choice

    return inquirer.checkbox(
        message="What should it include?",
        choices=[
            Choice(value=key, name=label, enabled=key in DEFAULT_INCLUDES)
            for key, label in INCLUDE_OPTIONS
        ],
        instruction="↑/↓ move · space toggle · enter confirm",
        transformer=lambda result: f"{len(result)} selected",
    ).execute()


def _poc_prompt_variant(message: str, variants: list[tuple[str, str]]) -> str:
    from InquirerPy import inquirer
    from InquirerPy.base.control import Choice

    return inquirer.select(
        message=message,
        choices=[Choice(value=key, name=name) for key, name in variants],
        default=variants[0][0],
    ).execute()


def _format_includes(includes: list[str], variants: dict[str, str]) -> str:
    parts = []
    for key in includes:
        label = INCLUDE_LABEL[key]
        variant = variants.get(key)
        if variant and variant in VARIANT_LABEL.get(key, {}):
            label = f"{label} ({VARIANT_LABEL[key][variant]})"
        parts.append(label)
    return ", ".join(parts) or "nothing"


def _resolve_includes(selected: list[str]) -> tuple[list[str], list[str]]:
    chosen = set(selected)
    auto = set()
    if "orders" in chosen:
        for dependency in ("products", "customers"):
            if dependency not in chosen:
                chosen.add(dependency)
                auto.add(dependency)
    if "cost_insights" in chosen and "customers" not in chosen:
        chosen.add("customers")
        auto.add("customers")

    order = [key for key, _ in INCLUDE_OPTIONS]
    includes = [key for key in order if key in chosen]
    auto_ordered = [key for key in order if key in auto]
    return includes, auto_ordered


def _poc_show_plan(
    kind: str,
    *,
    slug: str | None = None,
    owner: str = DEFAULT_OWNER,
    includes: list[str] | None = None,
    auto: list[str] | None = None,
    variants: dict[str, str] | None = None,
) -> None:
    includes = includes or []
    auto = auto or []
    variants = variants or {}

    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_column(style="dim")
    table.add_column(style="bold")

    if kind == "full":
        table.add_row("Action", "Full demo seed")
        table.add_row("Owner", owner)
        table.add_row("Includes", "everything (orgs, products, customers, orders, insights)")
        proposed = "dev seed"
    elif kind == "reset":
        table.add_row("Action", "Recreate database, then full demo seed")
        table.add_row("Owner", owner)
        table.add_row("Includes", "everything")
        proposed = "dev seed --reset"
    else:
        labels = _format_includes(includes, variants)
        table.add_row("Action", "Create single org")
        table.add_row("Slug", slug or "")
        table.add_row("Owner", owner)
        table.add_row("Includes", labels)
        if auto:
            added = ", ".join(INCLUDE_LABEL[key] for key in auto)
            table.add_row("Auto-added", f"{added} (required by orders)")
        proposed = (
            f"dev seed --new-org {slug} --owner {owner} "
            f"--include {','.join(includes) or 'none'}"
        )

    # table.add_row("Proposed CLI", proposed)

    console.print()
    console.print(
        Panel(
            table,
            title="[bold yellow]Org seeded![/bold yellow]",
            # subtitle="[dim]Nothing was seeded. --new-org / --reset still seed for real.[/dim]",
            border_style="yellow",
            padding=(1, 2),
        )
    )
    console.print()


def _poc_show_next_steps(*, slug: str | None = None, owner: str = DEFAULT_OWNER) -> None:
    dashboard = (
        f"http://127.0.0.1:3000/dashboard/{slug}" if slug else "http://127.0.0.1:3000"
    )

    steps = Table(show_header=False, box=None, padding=(0, 2))
    steps.add_column(style="bold cyan")
    steps.add_column()
    steps.add_row("1.", "Make sure services are running — [bold]dev start[/bold]")
    steps.add_row("2.", f"Log in as [bold]{owner}[/bold] at http://127.0.0.1:3000")
    steps.add_row("", "[dim]Grab the OTP from the terminal running [bold]dev api[/bold][/dim]")
    steps.add_row("3.", f"Open the dashboard — [bold]{dashboard}[/bold]")
    if not slug:
        steps.add_row("", "[dim]The admin account can access all seeded organizations[/dim]")

    console.print(
        Panel(
            steps,
            title="[bold blue]Next steps[/bold blue]",
            border_style="blue",
            padding=(1, 2),
        )
    )
    console.print()


def _run_seed_poc() -> bool:
    if not sys.stdin.isatty():
        return False
    try:
        kind = _poc_select_kind()
        if kind == "custom":
            slug = _poc_prompt_slug()
            owner = _poc_prompt_owner()
            includes, auto = _resolve_includes(_poc_prompt_includes())
            variants = {
                key: _poc_prompt_variant(VARIANT_PROMPTS[key], GROUP_VARIANTS[key])
                for key in includes
                if key in GROUP_VARIANTS
            }
            _poc_show_plan(
                "custom",
                slug=slug,
                owner=owner,
                includes=includes,
                auto=auto,
                variants=variants,
            )
            _poc_show_next_steps(slug=slug, owner=owner)
        else:
            owner = _poc_prompt_owner()
            _poc_show_plan(kind, owner=owner)
            _poc_show_next_steps(owner=owner)
        return True
    except Exception:
        return False


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def seed(
        new_org: str | None = typer.Option(
            None,
            "--new-org",
            help="Create a single new organization with this slug, with products, customers, and timeline events.",
        ),
        reset: bool = typer.Option(
            False,
            "--reset",
            help="Recreate the database before loading fresh seed data.",
        ),
        skip_tinybird: bool = typer.Option(
            False,
            "--skip-tinybird",
            help="Skip seeding events to Tinybird.",
        ),
    ) -> None:
        """Load sample data (users, organizations, products) into the database."""
        console.print()

        if not reset and not new_org and _run_seed_poc():
            return

        if reset and new_org:
            console.print("\n[red]--reset cannot be combined with --new-org.[/red]\n")
            raise typer.Exit(1)

        if reset:
            console.print(
                "[bold blue]Recreating database and loading fresh seeds...[/bold blue]\n"
            )

            console.print(
                "[yellow]This will delete all local database data before reseeding.[/yellow]"
            )
            if not _confirm("Continue?"):
                raise typer.Abort()
            console.print()

            with step_spinner("Recreating database..."):
                result = run_command(
                    ["uv", "run", "task", "db_recreate"],
                    cwd=SERVER_DIR,
                    capture=True,
                )
            if not result or result.returncode != 0:
                _print_command_output(result)
                console.print("\n[red]Database recreate failed.[/red]\n")
                raise typer.Exit(1)
            step_status(True, "Database recreated")

            _print_info("Loading fresh seed data. This usually takes a few minutes.")
            seed_cmd = ["uv", "run", "task", "seeds_load"]
            if skip_tinybird:
                seed_cmd.append("--skip-tinybird")
            with step_spinner("Seeding database..."):
                result = run_command(seed_cmd, cwd=SERVER_DIR, capture=True)
            if not result or result.returncode != 0:
                _print_command_output(result)
                console.print("\n[red]Seeding failed after database recreate.[/red]\n")
                raise typer.Exit(1)
            step_status(True, "Seed data loaded")

            _configure_polar_self_integration()
            _print_seeded_login_info()
            return

        if new_org:
            console.print(
                f"[bold blue]Creating organization '{new_org}'...[/bold blue]"
            )
            _print_info("With products, customers, and timeline events.")
            console.print()

            cmd = ["uv", "run", "task", "seeds_load", f"--new-org={new_org}"]
        else:
            console.print("[bold blue]Seeding database...[/bold blue]")
            _print_info(
                "Creating sample organizations, products, customers, and subscriptions."
            )
            console.print()

            cmd = ["uv", "run", "task", "seeds_load"]

        if skip_tinybird:
            cmd.append("--skip-tinybird")

        _print_info("This usually takes a few minutes.")
        with step_spinner("Seeding database..."):
            result = run_command(cmd, cwd=SERVER_DIR, capture=True)

        if result and result.returncode == 2:
            console.print()
            console.print(
                Panel(
                    "[dim]Use [bold]dev seed --new-org <slug>[/bold] to create additional organizations.[/dim]\n[dim]Use [bold]dev seed --reset[/bold] to recreate the database and load fresh seeds.[/dim]",
                    title="[bold yellow]Already seeded[/bold yellow]",
                    border_style="yellow",
                    padding=(1, 2),
                )
            )
            console.print()
            return

        if result and result.returncode == 0:
            step_status(True, "Seed data loaded")
            if not new_org:
                _configure_polar_self_integration()

            _print_seeded_login_info(new_org)
        else:
            _print_command_output(result)
            console.print("\n[red]Seeding failed.[/red]")
            console.print(
                "[dim]If the database already contains old seed data, run [bold]dev seed --reset[/bold] to recreate the database and load fresh seeds.[/dim]"
            )
            console.print(
                "[dim]Otherwise, make sure infrastructure is running (dev up) and migrations are applied.[/dim]\n"
            )
            raise typer.Exit(1)
