"""Configure GitHub and Stripe integrations."""


import typer

import stripe_config
from shared import (
    ROOT_DIR,
    Context,
    console,
    read_secrets,
    run_command,
    step_status,
    update_secrets,
)

NAME = "Configuring integrations"


def is_github_configured() -> bool:
    """Check if GitHub App is configured."""
    return bool(read_secrets().get("POLAR_GITHUB_CLIENT_ID"))


def is_github_skipped() -> bool:
    """Check if user chose to skip GitHub setup."""
    value = read_secrets().get("POLAR_SKIP_GITHUB_SETUP", "")
    return value.lower() == "true"


def set_github_skipped(skipped: bool = True) -> None:
    """Remember that user chose to skip GitHub setup."""
    update_secrets(
        {"POLAR_SKIP_GITHUB_SETUP": "true" if skipped else None}
    )


def is_stripe_skipped() -> bool:
    """Check if user chose to skip Stripe setup."""
    value = read_secrets().get("POLAR_SKIP_STRIPE_SETUP", "")
    return value.lower() == "true"


def set_stripe_skipped(skipped: bool = True) -> None:
    """Remember that user chose to skip Stripe setup."""
    update_secrets(
        {"POLAR_SKIP_STRIPE_SETUP": "true" if skipped else None}
    )


def _setup_stripe() -> None:
    """Interactive Stripe sandbox setup using the Stripe CLI."""
    console.print("\n  [bold]Stripe Setup[/bold]\n")
    console.print("  Polar uses Stripe for payment processing. You'll need a Stripe")
    console.print("  sandbox and the Stripe CLI to develop locally.\n")

    if stripe_config.configure() is None:
        return

    if is_stripe_skipped():
        set_stripe_skipped(False)

    console.print("\n  [bold]To receive webhooks locally, run:[/bold]")
    console.print("    [bold]dev stripe --listen[/bold]\n")


def _configure_stripe() -> None:
    profile = stripe_config.read_profile()
    rejection = stripe_config.saved_keys_rejection(profile)

    if rejection is None:
        step_status(True, "Stripe sandbox", profile.display_name)
        return

    if stripe_config.has_saved_keys():
        step_status(False, "Stripe", rejection)
        console.print("\n  [yellow]Local environments must use your own Stripe sandbox.[/yellow]")
        if typer.confirm("  Switch to a sandbox now?", default=True):
            _setup_stripe()
        return

    if is_stripe_skipped():
        step_status(True, "Stripe", "skipped (run with --clean to reconfigure)")
        return

    console.print("\n  [dim]Stripe is required for payments, subscriptions, and checkout.[/dim]")
    if typer.confirm("  Set up Stripe now?", default=True):
        _setup_stripe()
    elif typer.confirm("  Remember this choice?", default=True):
        set_stripe_skipped(True)
        step_status(True, "Stripe", "skipped (remembered)")
    else:
        step_status(True, "Stripe", "skipped (will ask again next time)")


def _configure_github() -> None:
    if is_github_configured():
        step_status(True, "GitHub App", "configured")
        return

    if is_github_skipped():
        step_status(True, "GitHub App", "skipped (run with --clean to reconfigure)")
        return

    console.print("\n  [dim]GitHub App enables login with GitHub and repository integrations.[/dim]")
    console.print("  [dim]You can skip this and still develop most features without it.[/dim]\n")
    if not typer.confirm("  Set up GitHub App now?", default=False):
        if typer.confirm("  Remember this choice?", default=True):
            set_github_skipped(True)
            step_status(True, "GitHub App", "skipped (remembered)")
        else:
            step_status(True, "GitHub App", "skipped (will ask again next time)")
        return

    console.print("\n  [bold]GitHub App Setup[/bold]\n")
    console.print("  [bold]Step 1:[/bold] Start ngrok to get an external URL")
    console.print("    Run in another terminal: [bold]ngrok http 8000[/bold]")
    console.print("    Get ngrok at: [link=https://ngrok.com]https://ngrok.com[/link]\n")

    external_url = typer.prompt("  Enter your ngrok URL (e.g., https://abc123.ngrok.dev)")

    console.print("\n  [bold]Step 2:[/bold] Your browser will open to create a GitHub App")
    console.print("    Just click through - all settings are pre-configured!\n")

    result = run_command(
        [
            str(ROOT_DIR / "dev" / "setup-environment"),
            "--setup-github-app",
            "--backend-external-url",
            external_url,
        ],
        capture=False,
    )
    if result and result.returncode == 0:
        step_status(True, "GitHub App", "configured")
        set_github_skipped(False)
    else:
        step_status(False, "GitHub App", "setup failed")


def run(ctx: Context) -> bool:
    """Configure GitHub and Stripe integrations."""
    if ctx.skip_integrations:
        return True

    if ctx.clean:
        set_github_skipped(False)
        set_stripe_skipped(False)

    _configure_github()
    _configure_stripe()

    return True
