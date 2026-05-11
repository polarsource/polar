"""Stripe integration commands."""

import typer

from shared import ROOT_DIR, SECRETS_FILE, console, run_command, step_status


def _is_stripe_cli_installed() -> bool:
    """Check if Stripe CLI is installed."""
    result = run_command(["which", "stripe"], capture=True)
    return result is not None and result.returncode == 0


def _is_stripe_cli_logged_in() -> bool:
    """Check if Stripe CLI is logged in by verifying API keys exist."""
    secret_key, publishable_key = _get_stripe_keys_from_cli()
    return bool(secret_key and publishable_key)


def _get_stripe_keys_from_cli() -> tuple[str, str]:
    """Get test mode API keys from Stripe CLI config."""
    result = run_command(["stripe", "config", "--list"], capture=True)
    if not result or result.returncode != 0:
        return "", ""

    secret_key = ""
    publishable_key = ""

    for line in result.stdout.split("\n"):
        line = line.strip()
        if line.startswith("test_mode_api_key"):
            secret_key = line.split("=", 1)[1].strip().strip("'\"")
        elif line.startswith("test_mode_pub_key"):
            publishable_key = line.split("=", 1)[1].strip().strip("'\"")

    return secret_key, publishable_key


def _is_stripe_configured() -> bool:
    """Check if Stripe keys are configured."""
    if SECRETS_FILE.exists():
        content = SECRETS_FILE.read_text()
        has_secret = False
        has_publishable = False
        for line in content.split("\n"):
            if line.startswith("POLAR_STRIPE_SECRET_KEY="):
                value = line.split("=", 1)[1].strip().strip("\"'")
                has_secret = bool(value)
            if line.startswith("POLAR_STRIPE_PUBLISHABLE_KEY="):
                value = line.split("=", 1)[1].strip().strip("\"'")
                has_publishable = bool(value)
        return has_secret and has_publishable
    return False


def _update_secrets_file(key: str, value: str | None) -> None:
    """Update a key in the secrets file."""
    SECRETS_FILE.parent.mkdir(parents=True, exist_ok=True)

    existing = {}
    if SECRETS_FILE.exists():
        for line in SECRETS_FILE.read_text().split("\n"):
            if "=" in line and not line.startswith("#"):
                k, v = line.split("=", 1)
                existing[k.strip()] = v.strip().strip("\"'")

    if value is None:
        existing.pop(key, None)
    else:
        existing[key] = value

    with open(SECRETS_FILE, "w") as f:
        for k, v in existing.items():
            delimiter = "'" if '"' in v else '"'
            f.write(f"{k}={delimiter}{v}{delimiter}\n")


def _save_stripe_keys(secret_key: str, publishable_key: str, webhook_secret: str = "") -> None:
    """Save Stripe keys to the central secrets file."""
    _update_secrets_file("POLAR_STRIPE_SECRET_KEY", secret_key)
    _update_secrets_file("POLAR_STRIPE_PUBLISHABLE_KEY", publishable_key)
    if webhook_secret:
        _update_secrets_file("POLAR_STRIPE_WEBHOOK_SECRET", webhook_secret)
        _update_secrets_file("POLAR_STRIPE_CONNECT_WEBHOOK_SECRET", webhook_secret)


def register(app: typer.Typer, prompt_setup: callable) -> None:
    @app.command()
    def stripe(
        listen: bool = typer.Option(False, "--listen", help="Start webhook forwarding after setup"),
        port: int = typer.Option(
            8000,
            "--port",
            "-p",
            help="API port to forward webhooks to (use the port shown by `dev docker up`)",
        ),
    ) -> None:
        """Set up Stripe integration for local development."""
        console.print("\n[bold blue]Stripe Setup[/bold blue]\n")

        if not _is_stripe_cli_installed():
            step_status(False, "Stripe CLI", "not installed")
            if typer.confirm("\n  Install Stripe CLI via Homebrew now?", default=True):
                console.print()
                result = run_command(["brew", "install", "stripe/stripe-cli/stripe"], capture=False)
                if not result or result.returncode != 0 or not _is_stripe_cli_installed():
                    console.print("[red]Installation failed. Install manually: brew install stripe/stripe-cli/stripe[/red]")
                    raise typer.Exit(1)
            else:
                console.print("[yellow]Stripe CLI is required. Install it and re-run dev stripe.[/yellow]")
                raise typer.Exit(1)
        step_status(True, "Stripe CLI", "installed")

        if not _is_stripe_cli_logged_in():
            step_status(False, "Stripe CLI", "not logged in")
            console.print("\n  This will open your browser to authenticate.\n")
            if typer.confirm("  Run 'stripe login' now?", default=True):
                run_command(["stripe", "login"], capture=False)
                if not _is_stripe_cli_logged_in():
                    console.print("[red]Stripe login failed. Please try again.[/red]")
                    raise typer.Exit(1)
            else:
                console.print("[yellow]Stripe login required to continue.[/yellow]")
                raise typer.Exit(1)
        step_status(True, "Stripe CLI", "logged in")

        if _is_stripe_configured():
            step_status(True, "Stripe API keys", "configured")
            _start_webhook_listener(port)
            return

        console.print("\n[bold]Fetching API keys from Stripe CLI...[/bold]")
        secret_key, publishable_key = _get_stripe_keys_from_cli()

        if secret_key and publishable_key:
            console.print(f"[green]✓ Secret key: {secret_key[:12]}...{secret_key[-4:]}[/green]")
            console.print(f"[green]✓ Publishable key: {publishable_key[:12]}...{publishable_key[-4:]}[/green]")
        else:
            console.print("[yellow]Could not fetch keys automatically. Please enter manually.[/yellow]")
            console.print("Get your test API keys from: [link=https://dashboard.stripe.com/test/apikeys]https://dashboard.stripe.com/test/apikeys[/link]\n")
            secret_key = typer.prompt("Stripe Secret Key (sk_test_...)")
            publishable_key = typer.prompt("Stripe Publishable Key (pk_test_...)")

        console.print("\n[bold]Getting webhook secret from Stripe CLI...[/bold]")
        result = run_command(["stripe", "listen", "--print-secret"], capture=True)
        webhook_secret = ""
        if result and result.returncode == 0:
            webhook_secret = result.stdout.strip()
            console.print("[green]✓ Webhook secret obtained[/green]")
        else:
            console.print("[yellow]Could not get webhook secret automatically.[/yellow]")
            webhook_secret = typer.prompt("Enter webhook secret manually (whsec_...), or press Enter to skip", default="")

        _save_stripe_keys(secret_key, publishable_key, webhook_secret)
        step_status(True, "Stripe API keys", "saved")

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
            "--forward-to", f"{base}/v1/integrations/stripe/webhook",
            "--forward-connect-to", f"{base}/v1/integrations/stripe/webhook-connect",
        ],
        capture=False,
    )
