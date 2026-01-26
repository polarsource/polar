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
        if typer.confirm("GitHub App not configured. Set it up now?", default=True):
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
        if typer.confirm("Stripe not configured. Set it up now?", default=True):
            console.print("\n[bold]Stripe Setup[/bold]\n")
            console.print("[bold]Step 1:[/bold] Create a Stripe account (if you don't have one)")
            console.print("  [link=https://dashboard.stripe.com/register]https://dashboard.stripe.com/register[/link]\n")

            console.print("[bold]Step 2:[/bold] Enable billing in your Stripe account")
            console.print("  [link=https://dashboard.stripe.com/billing/starter-guide]https://dashboard.stripe.com/billing/starter-guide[/link]\n")

            console.print("[bold]Step 3:[/bold] Copy your test API keys")
            console.print("  [link=https://dashboard.stripe.com/test/apikeys]https://dashboard.stripe.com/test/apikeys[/link]\n")

            secret_key = typer.prompt("Stripe Secret Key (sk_test_...)")
            publishable_key = typer.prompt("Stripe Publishable Key (pk_test_...)")

            console.print("\n[bold]Step 4:[/bold] Create a webhook endpoint (optional, for payment events)")
            console.print("  [link=https://dashboard.stripe.com/test/webhooks]https://dashboard.stripe.com/test/webhooks[/link]")
            console.print("  • Click 'Add endpoint'")
            console.print("  • URL: [bold]<your-ngrok-url>/v1/integrations/stripe/webhook[/bold]")
            console.print("  • Events: Select 'All events'")
            console.print("  • API version: [bold]2025-02-24.acacia[/bold]\n")
            webhook_secret = typer.prompt("Stripe Webhook Secret (whsec_..., or Enter to skip)", default="")

            save_stripe_keys(secret_key, publishable_key, webhook_secret)
            set_stripe_skipped(False)
            step_status(True, "Stripe", "configured")

            # Re-run setup-environment to merge secrets
            console.print("[dim]Updating environment files with Stripe keys...[/dim]")
            run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)
        else:
            if typer.confirm("Remember this choice?", default=True):
                set_stripe_skipped(True)
                step_status(True, "Stripe", "skipped (remembered)")
            else:
                step_status(True, "Stripe", "skipped (will ask again next time)")

    return True
