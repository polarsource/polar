"""Configure GitHub and Stripe integrations."""

from pathlib import Path

import typer

from shared import (
    Context,
    ROOT_DIR,
    SECRETS_FILE,
    console,
    run_command,
    step_status,
)

NAME = "Configuring integrations"


def is_github_configured() -> bool:
    """Check if GitHub App is configured."""
    if SECRETS_FILE.exists():
        content = SECRETS_FILE.read_text()
        if "POLAR_GITHUB_CLIENT_ID=" in content:
            for line in content.split("\n"):
                if line.startswith("POLAR_GITHUB_CLIENT_ID="):
                    value = line.split("=", 1)[1].strip().strip("\"'")
                    return bool(value)
    return False


def is_github_skipped() -> bool:
    """Check if user chose to skip GitHub setup."""
    if SECRETS_FILE.exists():
        for line in SECRETS_FILE.read_text().split("\n"):
            if line.startswith("POLAR_SKIP_GITHUB_SETUP="):
                value = line.split("=", 1)[1].strip().strip("\"'")
                return value.lower() == "true"
    return False


def set_github_skipped(skipped: bool = True) -> None:
    """Remember that user chose to skip GitHub setup."""
    _update_secrets_file("POLAR_SKIP_GITHUB_SETUP", "true" if skipped else None)


def is_stripe_configured() -> bool:
    """Check if Stripe is configured."""
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


def is_stripe_skipped() -> bool:
    """Check if user chose to skip Stripe setup."""
    if SECRETS_FILE.exists():
        for line in SECRETS_FILE.read_text().split("\n"):
            if line.startswith("POLAR_SKIP_STRIPE_SETUP="):
                value = line.split("=", 1)[1].strip().strip("\"'")
                return value.lower() == "true"
    return False


def set_stripe_skipped(skipped: bool = True) -> None:
    """Remember that user chose to skip Stripe setup."""
    _update_secrets_file("POLAR_SKIP_STRIPE_SETUP", "true" if skipped else None)


def save_stripe_keys(secret_key: str, publishable_key: str, webhook_secret: str = "") -> None:
    """Save Stripe keys to the central secrets file."""
    _update_secrets_file("POLAR_STRIPE_SECRET_KEY", secret_key)
    _update_secrets_file("POLAR_STRIPE_PUBLISHABLE_KEY", publishable_key)
    if webhook_secret:
        _update_secrets_file("POLAR_STRIPE_WEBHOOK_SECRET", webhook_secret)
        _update_secrets_file("POLAR_STRIPE_CONNECT_WEBHOOK_SECRET", webhook_secret)


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
        f.write("# Polar Development Secrets\n")
        f.write("# Shared across Git worktrees\n\n")
        for k, v in existing.items():
            delimiter = "'" if '"' in v else '"'
            f.write(f"{k}={delimiter}{v}{delimiter}\n")


def _is_stripe_cli_installed() -> bool:
    """Check if Stripe CLI is installed."""
    result = run_command(["which", "stripe"], capture=True)
    return result is not None and result.returncode == 0


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


def _is_stripe_cli_logged_in() -> bool:
    """Check if Stripe CLI is logged in by verifying API keys exist."""
    secret_key, publishable_key = _get_stripe_keys_from_cli()
    return bool(secret_key and publishable_key)


def _setup_stripe() -> None:
    """Interactive Stripe setup using Stripe CLI."""
    import webbrowser

    console.print("\n[bold]Stripe Setup[/bold]\n")
    console.print("  Polar uses Stripe for payment processing. You'll need a Stripe")
    console.print("  account and the Stripe CLI to develop locally.\n")
    console.print("  [dim]All keys are test mode only — no real charges will be made.[/dim]\n")

    # Step 1: Install Stripe CLI
    if not _is_stripe_cli_installed():
        step_status(False, "Stripe CLI", "not installed")
        if typer.confirm("\n  Install Stripe CLI via Homebrew now?", default=True):
            console.print()
            result = run_command(["brew", "install", "stripe/stripe-cli/stripe"], capture=False)
            if not result or result.returncode != 0 or not _is_stripe_cli_installed():
                console.print("[red]Installation failed. Install manually: brew install stripe/stripe-cli/stripe[/red]")
                return
        else:
            console.print("[yellow]Stripe CLI is required. Install it and re-run dev up.[/yellow]")
            return
    step_status(True, "Stripe CLI", "installed")

    # Step 2: Log in to Stripe
    if not _is_stripe_cli_logged_in():
        step_status(False, "Stripe CLI", "not logged in")

        console.print("\n  [dim]Don't have a Stripe account? Ask your team which account to use,[/dim]")
        console.print("  [dim]or create one at https://dashboard.stripe.com/register[/dim]\n")

        has_account = typer.confirm("  Do you have a Stripe account?", default=True)
        if not has_account:
            console.print("\n  Opening Stripe signup in your browser...")
            webbrowser.open("https://dashboard.stripe.com/register")
            typer.prompt("  Press Enter once you've created your account", default="")

        console.print("\n  Logging in to Stripe — this will open your browser to authenticate.\n")
        run_command(["stripe", "login"], capture=False)
        if not _is_stripe_cli_logged_in():
            console.print("[red]Stripe login failed. Please try again.[/red]")
            return
    step_status(True, "Stripe CLI", "logged in")

    # Step 3: Fetch API keys
    console.print("\n[bold]Fetching test API keys from Stripe CLI...[/bold]")
    secret_key, publishable_key = _get_stripe_keys_from_cli()

    if secret_key and publishable_key:
        console.print(f"[green]✓ Secret key: {secret_key[:12]}...{secret_key[-4:]}[/green]")
        console.print(f"[green]✓ Publishable key: {publishable_key[:12]}...{publishable_key[-4:]}[/green]")
    else:
        console.print("[yellow]Could not fetch keys automatically. Please enter manually.[/yellow]")
        console.print("Get your test API keys from: [link=https://dashboard.stripe.com/test/apikeys]https://dashboard.stripe.com/test/apikeys[/link]\n")
        secret_key = typer.prompt("Stripe Secret Key (sk_test_...)")
        publishable_key = typer.prompt("Stripe Publishable Key (pk_test_...)")

    # Step 4: Get webhook secret
    console.print("\n[bold]Getting webhook secret...[/bold]")
    console.print("[dim]Webhooks let Stripe notify your local server about payment events (e.g. checkout completed).[/dim]")
    result = run_command(["stripe", "listen", "--print-secret"], capture=True)
    webhook_secret = ""
    if result and result.returncode == 0:
        webhook_secret = result.stdout.strip()
        console.print("[green]✓ Webhook secret obtained[/green]")
    else:
        console.print("[yellow]Could not get webhook secret automatically.[/yellow]")
        webhook_secret = typer.prompt("Enter webhook secret manually (whsec_...), or press Enter to skip", default="")

    save_stripe_keys(secret_key, publishable_key, webhook_secret)
    set_stripe_skipped(False)
    step_status(True, "Stripe", "configured")

    console.print("[dim]Updating environment files...[/dim]")
    run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)

    console.print("\n[bold]To receive webhooks locally, run:[/bold]")
    console.print("  [bold]dev stripe --listen[/bold]\n")


def run(ctx: Context) -> bool:
    """Configure GitHub and Stripe integrations."""
    if ctx.skip_integrations:
        return True

    # Reset skip flags on clean
    if ctx.clean:
        set_github_skipped(False)
        set_stripe_skipped(False)

    # GitHub
    if is_github_configured():
        step_status(True, "GitHub App", "configured")
    elif is_github_skipped():
        step_status(True, "GitHub App", "skipped (run with --clean to reconfigure)")
    else:
        console.print("\n  [dim]GitHub App enables login with GitHub and repository integrations.[/dim]")
        console.print("  [dim]You can skip this and still develop most features without it.[/dim]\n")
        if typer.confirm("Set up GitHub App now?", default=False):
            console.print("\n[bold]GitHub App Setup[/bold]\n")
            console.print("[bold]Step 1:[/bold] Start ngrok to get an external URL")
            console.print("  Run in another terminal: [bold]ngrok http 8000[/bold]")
            console.print("  Get ngrok at: [link=https://ngrok.com]https://ngrok.com[/link]\n")

            external_url = typer.prompt("Enter your ngrok URL (e.g., https://abc123.ngrok.dev)")

            console.print("\n[bold]Step 2:[/bold] Your browser will open to create a GitHub App")
            console.print("  Just click through - all settings are pre-configured!\n")

            setup_args = [
                str(ROOT_DIR / "dev" / "setup-environment"),
                "--setup-github-app",
                "--backend-external-url",
                external_url,
            ]
            result = run_command(setup_args, capture=False)
            if result and result.returncode == 0:
                step_status(True, "GitHub App", "configured")
                set_github_skipped(False)
            else:
                step_status(False, "GitHub App", "setup failed")
        else:
            if typer.confirm("Remember this choice?", default=True):
                set_github_skipped(True)
                step_status(True, "GitHub App", "skipped (remembered)")
            else:
                step_status(True, "GitHub App", "skipped (will ask again next time)")

    # Stripe
    if is_stripe_configured():
        step_status(True, "Stripe", "configured")
    elif is_stripe_skipped():
        step_status(True, "Stripe", "skipped (run with --clean to reconfigure)")
    else:
        console.print("\n  [dim]Stripe is required for payments, subscriptions, and checkout.[/dim]")
        if typer.confirm("Set up Stripe now?", default=True):
            _setup_stripe()
        else:
            if typer.confirm("Remember this choice?", default=True):
                set_stripe_skipped(True)
                step_status(True, "Stripe", "skipped (remembered)")
            else:
                step_status(True, "Stripe", "skipped (will ask again next time)")

    return True
