"""Stripe integration commands."""

import typer

import stripe_config
from shared import ROOT_DIR, console, run_command, step_status


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def stripe(
        listen: bool = typer.Option(False, "--listen", help="Start webhook forwarding after setup"),
        relink: bool = typer.Option(False, "--relink", help="Link the Stripe CLI to a different sandbox"),
        port: int = typer.Option(
            8000,
            "--port",
            "-p",
            help="API port to forward webhooks to (use the port shown by `dev docker up`)",
        ),
    ) -> None:
        """Set up Stripe sandbox integration for local development."""
        console.print("\n[bold blue]Stripe Setup[/bold blue]\n")

        if not stripe_config.is_cli_installed():
            step_status(False, "Stripe CLI", "not installed")
            if not typer.confirm("\n  Install Stripe CLI via Homebrew now?", default=True):
                console.print("[yellow]Stripe CLI is required. Install it and re-run dev stripe.[/yellow]")
                raise typer.Exit(1)
            console.print()
            if not stripe_config.install_cli():
                console.print("[red]Installation failed. Install manually: brew install stripe/stripe-cli/stripe[/red]")
                raise typer.Exit(1)
        step_status(True, "Stripe CLI", "installed")

        if relink:
            stripe_config.print_sandbox_instructions()
            if not stripe_config.login():
                console.print("[red]Stripe login failed. Please try again.[/red]")
                raise typer.Exit(1)

        profile = stripe_config.ensure_sandbox_profile()
        if profile is None:
            raise typer.Exit(1)
        step_status(True, "Stripe sandbox", profile.display_name)

        status, _ = stripe_config.secrets_status()
        changed = False

        if status == "ok":
            step_status(True, "Stripe API keys", "configured")
        else:
            stripe_config.save_keys(profile)
            step_status(True, "Stripe API keys", "saved")
            changed = True

        # New keys mean a different sandbox, so the stored listener secret is stale.
        if changed or not stripe_config.read_secrets().get("POLAR_STRIPE_WEBHOOK_SECRET"):
            console.print("\n[bold]Getting webhook secret from Stripe CLI...[/bold]")
            webhook_secret = stripe_config.fetch_webhook_secret()
            if not webhook_secret:
                console.print("[yellow]Could not get webhook secret automatically.[/yellow]")
                webhook_secret = typer.prompt(
                    "Enter webhook secret manually (whsec_...), or press Enter to skip", default=""
                )
            if webhook_secret:
                stripe_config.save_webhook_secret(webhook_secret)
                step_status(True, "Webhook secret", "saved")
                changed = True

        if changed:
            console.print("[dim]Updating environment files...[/dim]")
            run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)
            step_status(True, "Environment files", "updated")
            console.print("\n[bold green]Stripe setup complete![/bold green]\n")

        if listen or typer.confirm("Start webhook forwarding now?", default=True):
            _start_webhook_listener(port)
        else:
            console.print("[bold]To start webhook forwarding later:[/bold]")
            console.print("  [bold]dev stripe --listen[/bold]\n")


def _start_webhook_listener(port: int = 8000) -> None:
    """Start Stripe webhook forwarding."""
    base = f"http://127.0.0.1:{port}"
    console.print("\n[bold]Starting Stripe webhook forwarding...[/bold]")
    console.print(f"[dim]Forwarding to:         {base}/v1/integrations/stripe/webhook[/dim]")
    console.print(f"[dim]Connect forwarding to: {base}/v1/integrations/stripe/webhook-connect[/dim]")
    console.print("[dim]Press Ctrl+C to stop[/dim]\n")
    run_command(
        [
            "stripe", "listen",
            "-p", stripe_config.STRIPE_CLI_PROFILE,
            "--forward-to", f"{base}/v1/integrations/stripe/webhook",
            "--forward-connect-to", f"{base}/v1/integrations/stripe/webhook-connect",
        ],
        capture=False,
    )
