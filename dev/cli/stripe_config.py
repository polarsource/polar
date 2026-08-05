"""Stripe sandbox setup shared by `dev up` and `dev stripe`.

A local environment must talk to a personal Stripe sandbox: never a live
account, and never a shared team account.
"""

import webbrowser
from dataclasses import dataclass

import typer

from shared import (
    ROOT_DIR,
    check_command_exists,
    console,
    read_secrets,
    run_command,
    step_spinner,
    step_status,
    update_secrets,
)

STRIPE_CLI_PROFILE = "polar-sandbox"
SANDBOX_DASHBOARD_URL = "https://dashboard.stripe.com/sandboxes"


@dataclass
class StripeProfile:
    account_id: str
    display_name: str
    secret_key: str
    publishable_key: str
    has_live_key: bool


def ensure_cli() -> bool:
    """Make sure the Stripe CLI is installed, offering to install it."""
    if check_command_exists("stripe"):
        step_status(True, "Stripe CLI", "installed")
        return True

    step_status(False, "Stripe CLI", "not installed")
    if not typer.confirm("\n  Install Stripe CLI via Homebrew now?", default=True):
        console.print("  [yellow]Stripe CLI is required to continue.[/yellow]")
        return False

    with step_spinner("Installing Stripe CLI..."):
        result = run_command(["brew", "install", "stripe/stripe-cli/stripe"], capture=True)
    if not result or result.returncode != 0 or not check_command_exists("stripe"):
        console.print(
            "  [red]Installation failed. Install manually: brew install stripe/stripe-cli/stripe[/red]"
        )
        return False

    step_status(True, "Stripe CLI", "installed")
    return True


def read_profile() -> StripeProfile | None:
    """Read the sandbox profile through the Stripe CLI's own config resolution."""
    result = run_command(
        ["stripe", "config", "--list", "-p", STRIPE_CLI_PROFILE], capture=True
    )
    if not result or result.returncode != 0:
        return None

    values = {}
    for line in result.stdout.splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("["):
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip("'\"")

    if not values:
        return None

    return StripeProfile(
        account_id=values.get("account_id", ""),
        display_name=values.get("display_name", STRIPE_CLI_PROFILE),
        secret_key=values.get("test_mode_api_key", ""),
        publishable_key=values.get("test_mode_pub_key", ""),
        has_live_key=bool(values.get("live_mode_api_key")),
    )


def sandbox_rejection(profile: StripeProfile) -> str | None:
    """Explain why this profile can't back a local environment, or None if it can."""
    if not profile.secret_key or not profile.publishable_key:
        return "no test keys stored for this profile"
    if not profile.secret_key.startswith("sk_test_"):
        return "it holds a live secret key"
    if not profile.publishable_key.startswith("pk_test_"):
        return "it holds a live publishable key"
    # A sandbox has no live mode at all, so the CLI stores no live key for one.
    if profile.has_live_key:
        return f"'{profile.display_name}' is a full Stripe account, not a sandbox"
    return None


def keys_are_usable() -> bool:
    """Check the stored keys still work — Stripe CLI keys expire after 90 days."""
    result = run_command(
        ["stripe", "get", "/v1/account", "-p", STRIPE_CLI_PROFILE], capture=True
    )
    return result is not None and result.returncode == 0


def has_saved_keys() -> bool:
    secrets = read_secrets()
    return bool(
        secrets.get("POLAR_STRIPE_SECRET_KEY")
        and secrets.get("POLAR_STRIPE_PUBLISHABLE_KEY")
    )


def saved_keys_rejection(profile: StripeProfile | None) -> str | None:
    """Why the saved Stripe keys can't back a local environment, or None if they can."""
    if not has_saved_keys():
        return "no Stripe keys are configured"

    secret_key = read_secrets().get("POLAR_STRIPE_SECRET_KEY", "")
    if not secret_key.startswith("sk_test_"):
        return "a live secret key is configured"
    if profile is None:
        return f"there is no '{STRIPE_CLI_PROFILE}' Stripe CLI profile"
    if secret_key != profile.secret_key:
        return f"the keys don't match the '{STRIPE_CLI_PROFILE}' sandbox"
    return sandbox_rejection(profile)


def print_sandbox_instructions() -> None:
    console.print(
        "\n  Local development runs against your own Stripe [bold]sandbox[/bold] —"
    )
    console.print("  no live account, no shared team account.\n")
    console.print("  [bold]1.[/bold] Create a sandbox (or pick an existing one) at")
    console.print(f"     [link={SANDBOX_DASHBOARD_URL}]{SANDBOX_DASHBOARD_URL}[/link]")
    console.print("  [bold]2.[/bold] Open that sandbox, so it's the selected account")
    console.print("  [bold]3.[/bold] Confirm the pairing in the browser tab we open next\n")


def link_sandbox() -> StripeProfile | None:
    """Walk the user through pairing the Stripe CLI with a sandbox."""
    print_sandbox_instructions()
    if not typer.confirm("  Open the Stripe sandbox dashboard now?", default=True):
        console.print("  [yellow]A sandbox is required to continue.[/yellow]")
        return None

    webbrowser.open(SANDBOX_DASHBOARD_URL)
    typer.prompt(
        "  Press Enter once your sandbox is open in the dashboard",
        default="",
        show_default=False,
    )

    console.print("\n  Linking the Stripe CLI to that sandbox...\n")
    result = run_command(
        ["stripe", "login", "--project-name", STRIPE_CLI_PROFILE], capture=False
    )
    if not result or result.returncode != 0:
        console.print("  [red]Stripe login failed. Please try again.[/red]")
        return None

    profile = read_profile()
    if profile is None:
        console.print("  [red]Stripe login didn't store any keys.[/red]")
        return None

    rejection = sandbox_rejection(profile)
    if rejection is not None:
        console.print(f"\n  [red]You linked '{profile.display_name}', but {rejection}.[/red]")
        console.print("  [red]Re-run this and pick a sandbox instead.[/red]")
        return None

    return profile


def ensure_sandbox_profile(relink: bool = False) -> StripeProfile | None:
    """Get a usable sandbox profile, walking through pairing when needed."""
    if relink:
        return link_sandbox()

    profile = read_profile()
    if profile is not None:
        rejection = sandbox_rejection(profile)
        if rejection is not None:
            step_status(False, "Stripe sandbox", rejection)
        elif keys_are_usable():
            return profile
        else:
            step_status(False, "Stripe sandbox", "the stored key has expired")
            console.print("\n  [dim]Stripe CLI keys expire after 90 days.[/dim]")

    return link_sandbox()


def save_keys(profile: StripeProfile) -> None:
    update_secrets(
        {
            "POLAR_STRIPE_SECRET_KEY": profile.secret_key,
            "POLAR_STRIPE_PUBLISHABLE_KEY": profile.publishable_key,
        }
    )


def obtain_webhook_secret() -> str:
    console.print("\n  [bold]Getting webhook secret from the Stripe CLI...[/bold]")
    console.print(
        "  [dim]Webhooks let Stripe notify your local server about payment events.[/dim]"
    )
    result = run_command(
        ["stripe", "listen", "--print-secret", "-p", STRIPE_CLI_PROFILE], capture=True
    )
    if result and result.returncode == 0 and result.stdout.strip():
        return result.stdout.strip()

    console.print("  [yellow]Could not get webhook secret automatically.[/yellow]")
    return typer.prompt(
        "  Enter webhook secret manually (whsec_...), or press Enter to skip", default=""
    )


def save_webhook_secret(webhook_secret: str) -> None:
    """Store the `stripe listen` secret for both webhook endpoints.

    One listener signs both the direct and the Connect endpoint, so both
    secrets are the same value. Someone using dashboard endpoints instead has
    two *different* secrets — leave those alone rather than clobber them.
    """
    secrets = read_secrets()
    direct = secrets.get("POLAR_STRIPE_WEBHOOK_SECRET", "")
    connect = secrets.get("POLAR_STRIPE_CONNECT_WEBHOOK_SECRET", "")
    if direct and connect and direct != connect:
        console.print(
            "  [yellow]Kept your existing webhook secrets — they differ from each\n"
            "  other, so they look like dashboard endpoints, not the CLI listener.[/yellow]"
        )
        return

    update_secrets(
        {
            "POLAR_STRIPE_WEBHOOK_SECRET": webhook_secret,
            "POLAR_STRIPE_CONNECT_WEBHOOK_SECRET": webhook_secret,
        }
    )
    step_status(True, "Webhook secret", "saved")


def configure(relink: bool = False) -> StripeProfile | None:
    """Link a sandbox and write its keys into the central secrets file."""
    if not ensure_cli():
        return None

    profile = ensure_sandbox_profile(relink=relink)
    if profile is None:
        return None
    step_status(True, "Stripe sandbox", profile.display_name)

    changed = False
    if saved_keys_rejection(profile) is None:
        step_status(True, "Stripe API keys", "configured")
    else:
        save_keys(profile)
        step_status(True, "Stripe API keys", "saved")
        changed = True

    # New keys mean a different sandbox, so the stored listener secret is stale.
    if changed or not read_secrets().get("POLAR_STRIPE_WEBHOOK_SECRET"):
        webhook_secret = obtain_webhook_secret()
        if webhook_secret:
            save_webhook_secret(webhook_secret)
            changed = True

    if changed:
        console.print("  [dim]Updating environment files...[/dim]")
        run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)
        step_status(True, "Environment files", "updated")

    return profile
