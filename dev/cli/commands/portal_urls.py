"""Print authenticated customer portal URLs, ready to paste into `dev snap`.

The portal sits behind `?customer_session_token=`, and `dev snap` only knows how to
log into `/dashboard`. This mints a session against the seeded data instead, so a
snap run needs no interaction.
"""

from typing import Annotated

import typer

from shared import DEFAULT_WEB_PORT, SERVER_DIR, console, run_command

WEB_BASE_URL = f"http://127.0.0.1:{DEFAULT_WEB_PORT}"


def _portal_paths(seed: dict[str, str]) -> list[str]:
    """Every portal route, in navigation order. Routes behind an id are skipped
    when the seed has nothing to point them at."""
    subscription_id = seed.get("SUBSCRIPTION_ID")
    order_id = seed.get("ORDER_ID")
    return [
        "/portal/overview",
        *([f"/portal/subscriptions/{subscription_id}"] if subscription_id else []),
        "/portal/orders",
        *([f"/portal/orders/{order_id}"] if order_id else []),
        "/portal/settings",
        "/portal/usage",
        "/portal/wallet",
    ]


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command(name="portal-urls")
    def portal_urls(
        org: Annotated[
            str,
            typer.Option("--org", help="Organization slug to pick a customer from"),
        ] = "acme-corp",
        ttl_hours: Annotated[
            int,
            typer.Option("--ttl-hours", help="Session lifetime"),
        ] = 24,
        snap: Annotated[
            bool,
            typer.Option("--snap", help="Print a ready-to-run `dev snap` command"),
        ] = False,
    ) -> None:
        """Print customer portal URLs with a fresh session token."""
        result = run_command(
            [
                "uv",
                "run",
                "python",
                "-m",
                "scripts.seeds_load",
                "customer-portal-session",
                "--org",
                org,
                "--ttl-hours",
                str(ttl_hours),
            ],
            cwd=SERVER_DIR,
            capture=True,
        )
        if not result or result.returncode != 0:
            console.print("[red]Could not mint a customer session.[/red]")
            output = (getattr(result, "stdout", "") or "").strip()
            if output:
                console.print(f"[dim]{output}[/dim]")
            raise typer.Exit(1)

        seed = dict(
            line.strip().split("=", 1)
            for line in result.stdout.split("\n")
            if "=" in line
        )
        token = seed.get("CUSTOMER_SESSION_TOKEN")
        slug = seed.get("ORGANIZATION_SLUG")
        if not token or not slug:
            console.print("[red]Seed output missing a session token.[/red]")
            raise typer.Exit(1)

        urls = [
            f"{WEB_BASE_URL}/{slug}{path}?customer_session_token={token}"
            for path in _portal_paths(seed)
        ]

        console.print()
        if snap:
            command = f"dev snap --url '{','.join(urls)}' --viewport desktop,mobile"
            console.print(command, soft_wrap=True)
        else:
            for url in urls:
                console.print(url, soft_wrap=True)
        console.print()
