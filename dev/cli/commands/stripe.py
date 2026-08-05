"""Stripe integration commands."""

import typer

import stripe_config
from shared import console, run_command


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

        if stripe_config.configure(relink=relink) is None:
            raise typer.Exit(1)

        if listen or typer.confirm("\nStart webhook forwarding now?", default=True):
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
