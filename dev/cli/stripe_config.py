"""Stripe sandbox setup shared by `dev up` and `dev stripe`.

A local environment must talk to a personal Stripe **sandbox**: never a live
account, and never the shared Polar Software Inc account.
"""

import tomllib
import webbrowser
from dataclasses import dataclass
from pathlib import Path

import typer

from shared import console, read_secrets, run_command, step_status, update_secrets

STRIPE_CLI_PROFILE = "polar-sandbox"
STRIPE_CLI_CONFIG = Path.home() / ".config" / "stripe" / "config.toml"
SANDBOX_DASHBOARD_URL = "https://dashboard.stripe.com/sandboxes"

BLOCKED_ACCOUNT_IDS = {
    "acct_1LzIVeDG1jUQrXwC": "the shared Polar Software Inc account",
}


@dataclass
class StripeProfile:
    name: str
    account_id: str
    display_name: str
    secret_key: str
    publishable_key: str
    has_live_key: bool


def is_cli_installed() -> bool:
    result = run_command(["which", "stripe"], capture=True)
    return result is not None and result.returncode == 0


def install_cli() -> bool:
    """Install the Stripe CLI via Homebrew. Returns True once it is available."""
    result = run_command(["brew", "install", "stripe/stripe-cli/stripe"], capture=False)
    return result is not None and result.returncode == 0 and is_cli_installed()


def read_profile(name: str = STRIPE_CLI_PROFILE) -> StripeProfile | None:
    """Read a profile out of the Stripe CLI config, or None if it isn't there."""
    if not STRIPE_CLI_CONFIG.exists():
        return None
    try:
        config = tomllib.loads(STRIPE_CLI_CONFIG.read_text())
    except (tomllib.TOMLDecodeError, OSError):
        return None

    section = config.get(name)
    if not isinstance(section, dict):
        return None

    return StripeProfile(
        name=name,
        account_id=str(section.get("account_id", "")),
        display_name=str(section.get("display_name", name)),
        secret_key=str(section.get("test_mode_api_key", "")),
        publishable_key=str(section.get("test_mode_pub_key", "")),
        has_live_key=bool(section.get("live_mode_api_key")),
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
    blocked = BLOCKED_ACCOUNT_IDS.get(profile.account_id)
    if blocked:
        return f"it is {blocked}"
    return None


def keys_are_usable(profile_name: str = STRIPE_CLI_PROFILE) -> bool:
    """Check the stored keys still work — CLI keys expire after 90 days."""
    result = run_command(
        ["stripe", "get", "/v1/account", "-p", profile_name], capture=True
    )
    return result is not None and result.returncode == 0


def login(profile_name: str = STRIPE_CLI_PROFILE) -> bool:
    result = run_command(
        ["stripe", "login", "--project-name", profile_name], capture=False
    )
    return result is not None and result.returncode == 0


def secrets_status() -> tuple[str, str]:
    """Classify the Stripe keys currently in the secrets file.

    Returns (status, detail) where status is one of:
      ok        - keys match the sandbox profile
      missing   - no keys configured
      live      - live keys, which must never reach a local environment
      mismatch  - test keys from some other account than the sandbox profile
    """
    secrets = read_secrets()
    secret_key = secrets.get("POLAR_STRIPE_SECRET_KEY", "")
    publishable_key = secrets.get("POLAR_STRIPE_PUBLISHABLE_KEY", "")

    if not secret_key or not publishable_key:
        return "missing", "no keys configured"
    if not secret_key.startswith("sk_test_"):
        return "live", "a live secret key is configured"

    profile = read_profile()
    if profile is None:
        return "mismatch", f"no '{STRIPE_CLI_PROFILE}' Stripe CLI profile"
    if secret_key != profile.secret_key:
        return "mismatch", f"keys don't match the '{STRIPE_CLI_PROFILE}' sandbox"
    return "ok", profile.display_name


def save_keys(profile: StripeProfile) -> None:
    update_secrets(
        {
            "POLAR_STRIPE_SECRET_KEY": profile.secret_key,
            "POLAR_STRIPE_PUBLISHABLE_KEY": profile.publishable_key,
        }
    )


def save_webhook_secret(webhook_secret: str) -> bool:
    """Store the `stripe listen` secret for both webhook endpoints.

    One listener signs both the direct and the Connect endpoint, so both
    secrets are the same value. Someone using dashboard endpoints instead has
    two *different* secrets — leave those alone rather than clobber them.
    """
    secrets = read_secrets()
    direct = secrets.get("POLAR_STRIPE_WEBHOOK_SECRET", "")
    connect = secrets.get("POLAR_STRIPE_CONNECT_WEBHOOK_SECRET", "")
    if direct and connect and direct != connect:
        return False

    update_secrets(
        {
            "POLAR_STRIPE_WEBHOOK_SECRET": webhook_secret,
            "POLAR_STRIPE_CONNECT_WEBHOOK_SECRET": webhook_secret,
        }
    )
    return True


def print_sandbox_instructions() -> None:
    console.print(
        "\n  Local development runs against your own Stripe [bold]sandbox[/bold] —"
    )
    console.print("  no live account, no shared Polar account.\n")
    console.print("  [bold]1.[/bold] Create a sandbox (or pick an existing one) at")
    console.print(f"     [link={SANDBOX_DASHBOARD_URL}]{SANDBOX_DASHBOARD_URL}[/link]")
    console.print("  [bold]2.[/bold] Open that sandbox, so it's the selected account")
    console.print("  [bold]3.[/bold] Confirm the pairing in the browser tab we open next\n")


def ensure_sandbox_profile(interactive: bool = True) -> StripeProfile | None:
    """Get a usable sandbox profile, walking through login when needed."""
    profile = read_profile()

    if profile is not None:
        rejection = sandbox_rejection(profile)
        if rejection is not None:
            step_status(False, "Stripe sandbox", rejection)
            console.print(
                f"\n  The '{STRIPE_CLI_PROFILE}' profile can't be used: {rejection}."
            )
        elif keys_are_usable():
            return profile
        else:
            step_status(False, "Stripe sandbox", "the stored key has expired")
            console.print("\n  [dim]Stripe CLI keys expire after 90 days.[/dim]")

    if not interactive:
        return None

    print_sandbox_instructions()
    if not typer.confirm("  Open the Stripe sandbox dashboard now?", default=True):
        console.print("  [yellow]A sandbox is required to continue.[/yellow]")
        return None

    webbrowser.open(SANDBOX_DASHBOARD_URL)
    typer.prompt(
        "  Press Enter once your sandbox is open in the dashboard", default="", show_default=False
    )

    console.print("\n  Linking the Stripe CLI to that sandbox...\n")
    if not login():
        console.print("  [red]Stripe login failed. Please try again.[/red]")
        return None

    profile = read_profile()
    if profile is None:
        console.print("  [red]Stripe login didn't store any keys.[/red]")
        return None

    rejection = sandbox_rejection(profile)
    if rejection is not None:
        step_status(False, "Stripe sandbox", rejection)
        console.print(
            f"\n  [red]You linked '{profile.display_name}', but {rejection}.[/red]"
        )
        console.print("  [red]Re-run this and pick a sandbox instead.[/red]")
        return None

    return profile


def fetch_webhook_secret() -> str:
    result = run_command(
        ["stripe", "listen", "--print-secret", "-p", STRIPE_CLI_PROFILE], capture=True
    )
    if result and result.returncode == 0:
        return result.stdout.strip()
    return ""
