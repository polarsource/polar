"""Stripe sandbox setup shared by `dev up` and `dev stripe`.

A local environment must talk to a personal Stripe sandbox: never a live
account, and never a shared team account.
"""

import json
import webbrowser
from dataclasses import dataclass

import typer
from dotenv import dotenv_values

from secrets_io import ensure_secrets_file
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
TAX_SETTINGS_URL = "https://dashboard.stripe.com/test/tax/settings"
TAX_REGISTRATIONS_URL = "https://dashboard.stripe.com/test/tax/registrations"


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


def key_auth_failure() -> str | None:
    """Why Stripe rejected the stored key, or None if it didn't reject it.

    Only an authentication answer counts. A missing CLI, an outage or a
    dropped network gives a non-zero exit too, and sending someone through a
    re-link for that would be wrong — so anything unrecognised passes.
    """
    result = run_command(
        ["stripe", "get", "/v1/account", "-p", STRIPE_CLI_PROFILE], capture=True
    )
    if result is None or result.returncode == 0:
        return None

    output = f"{result.stdout} {result.stderr}".lower()
    if "expired" in output:
        return "the Stripe CLI key has expired (they last 90 days)"
    if "invalid api key" in output or "authentication" in output:
        return "Stripe rejected the stored key"
    return None


def env_needs_sync() -> bool:
    """True when the generated env files don't carry the Stripe values from secrets.

    Without this, a run that saved the keys but failed to regenerate the env
    files would look fully configured next time, leaving the services on the
    previous account's credentials. The web env is checked too: it carries the
    publishable key the browser tokenizes with, so a stale one would have the
    browser and the backend on different sandboxes.
    """
    secrets = read_secrets()
    server_env = ROOT_DIR / "server" / ".env"
    web_env = ROOT_DIR / "clients" / "apps" / "web" / ".env.local"

    if not server_env.exists() or not web_env.exists():
        return True

    server = dotenv_values(server_env, interpolate=False)
    if any(
        server.get(key) != secrets.get(key)
        for key in (
            "POLAR_STRIPE_SECRET_KEY",
            "POLAR_STRIPE_PUBLISHABLE_KEY",
            "POLAR_STRIPE_WEBHOOK_SECRET",
            "POLAR_STRIPE_CONNECT_WEBHOOK_SECRET",
        )
    ):
        return True

    publishable_key = secrets.get("POLAR_STRIPE_PUBLISHABLE_KEY")
    if server.get("NEXT_PUBLIC_STRIPE_KEY") != publishable_key:
        return True

    web = dotenv_values(web_env, interpolate=False)
    return web.get("NEXT_PUBLIC_STRIPE_KEY") != publishable_key


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

    secrets = read_secrets()
    secret_key = secrets.get("POLAR_STRIPE_SECRET_KEY", "")
    publishable_key = secrets.get("POLAR_STRIPE_PUBLISHABLE_KEY", "")
    if not secret_key.startswith("sk_test_"):
        return "a live secret key is configured"
    if not publishable_key.startswith("pk_test_"):
        return "a live publishable key is configured"
    if profile is None:
        return f"there is no '{STRIPE_CLI_PROFILE}' Stripe CLI profile"
    # The browser tokenizes the card with the publishable key while the backend
    # charges with the secret key, so a split pair silently talks to two accounts.
    if secret_key != profile.secret_key or publishable_key != profile.publishable_key:
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
        rejection = sandbox_rejection(profile) or key_auth_failure()
        if rejection is None:
            return profile
        step_status(False, "Stripe sandbox", rejection)

    return link_sandbox()


def _get_json(path: str) -> dict | None:
    result = run_command(["stripe", "get", path, "-p", STRIPE_CLI_PROFILE], capture=True)
    if not result or result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def check_tax() -> None:
    """Report on Stripe Tax, which checkout needs before it can price an order."""
    settings = _get_json("/v1/tax/settings")
    if settings is None:
        return

    if settings.get("status") != "active":
        step_status(False, "Stripe Tax", settings.get("status", "not set up"))
        console.print(
            "\n  [yellow]Checkout fails while Stripe Tax is inactive — it can't price\n"
            "  an order. Activate it (set a head office address) at[/yellow]"
        )
        console.print(f"  [link={TAX_SETTINGS_URL}]{TAX_SETTINGS_URL}[/link]\n")
        return

    registrations = _get_json("/v1/tax/registrations")
    if registrations is None:
        step_status(True, "Stripe Tax", "active")
        return

    active = [r for r in registrations.get("data", []) if r.get("status") == "active"]
    if active:
        countries = ", ".join(sorted({r.get("country", "?") for r in active}))
        step_status(True, "Stripe Tax", f"active ({countries})")
        return

    step_status(True, "Stripe Tax", "active, no registrations")
    console.print("  [dim]Every order is taxed at 0. Add a registration to test tax:[/dim]")
    console.print(f"  [dim][link={TAX_REGISTRATIONS_URL}]{TAX_REGISTRATIONS_URL}[/link][/dim]")


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
    entered = typer.prompt(
        "  Enter webhook secret manually (whsec_...), or press Enter to skip", default=""
    ).strip()
    if entered and not entered.startswith("whsec_"):
        console.print("  [yellow]That isn't a webhook secret (they start with whsec_). Skipping.[/yellow]")
        return ""
    return entered


def save_webhook_secret(webhook_secret: str) -> None:
    """Store the `stripe listen` secret for both webhook endpoints.

    One listener signs both the direct and the Connect endpoint, so both
    secrets are the same value. Someone using dashboard endpoints instead has
    two *different* secrets — leave those alone rather than clobber them.
    """
    secrets = read_secrets()
    direct = secrets.get("POLAR_STRIPE_WEBHOOK_SECRET", "")
    connect = secrets.get("POLAR_STRIPE_CONNECT_WEBHOOK_SECRET", "")
    if direct != connect:
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
    # Also tightens the file to 0600 if an older run left it readable.
    ensure_secrets_file()

    if not ensure_cli():
        return None

    profile = ensure_sandbox_profile(relink=relink)
    if profile is None:
        return None
    step_status(True, "Stripe sandbox", profile.display_name)
    check_tax()

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
        elif changed:
            step_status(False, "Webhook secret", "still the previous sandbox's")
            console.print(
                "  [yellow]Webhooks will fail signature checks until you set it.\n"
                "  Re-run `dev stripe` once the Stripe CLI can reach Stripe.[/yellow]"
            )

    if changed or env_needs_sync():
        console.print("  [dim]Updating environment files...[/dim]")
        result = run_command([str(ROOT_DIR / "dev" / "setup-environment")], capture=True)
        if result and result.returncode == 0:
            step_status(True, "Environment files", "updated")
        else:
            step_status(False, "Environment files", "update failed")
            console.print("  [yellow]Run dev/setup-environment by hand to see why.[/yellow]")
            return None

    return profile
