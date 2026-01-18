"""Account section with payment account details."""

import contextlib
from collections.abc import Generator, Sequence
from datetime import UTC, datetime

from fastapi import Request
from markupflow import Fragment

from polar.enums import AccountType
from polar.models import AccountCredit, Organization

from ....components import button, card


def _get_credit_status(credit: AccountCredit) -> tuple[str, str]:
    """Get status label and badge class for a credit."""
    now = datetime.now(UTC)

    if credit.revoked_at is not None:
        return ("Revoked", "badge-error")
    if credit.expires_at is not None and credit.expires_at <= now:
        return ("Expired", "badge-warning")
    if credit.remaining <= 0:
        return ("Exhausted", "badge-neutral")
    return ("Active", "badge-success")


def _format_cents(cents: int) -> str:
    """Format cents as dollars."""
    return f"${cents / 100:,.2f}"


def _format_date(dt: datetime | None) -> str:
    """Format datetime for display."""
    if dt is None:
        return "—"
    return dt.strftime("%Y-%m-%d %H:%M")


class AccountSection:
    """Render the account section with payment details."""

    def __init__(
        self,
        organization: Organization,
        credits: Sequence[AccountCredit] | None = None,
    ):
        self.org = organization
        self.credits = credits or []
        self.available_balance = (
            self.org.account.credit_balance if self.org.account else 0
        )

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[Fragment]:
        """Render the account section."""
        fragment = Fragment()

        with fragment.div(class_="space-y-6"):
            # Account details card
            with card(bordered=True):
                with fragment.h2(class_="text-lg font-bold mb-4"):
                    fragment.text("Payment Account")

                if self.org.account:
                    account = self.org.account

                    # Account type and status
                    with fragment.div(class_="space-y-4"):
                        with fragment.div(class_="grid grid-cols-2 gap-4"):
                            with fragment.div():
                                with fragment.div(
                                    class_="text-sm text-base-content/60 mb-1"
                                ):
                                    fragment.text("Account ID")
                                with fragment.div(class_="font-mono text-sm"):
                                    fragment.text(str(account.id))

                            with fragment.div():
                                with fragment.div(
                                    class_="text-sm text-base-content/60 mb-1"
                                ):
                                    fragment.text("Type")
                                with fragment.div(class_="font-semibold"):
                                    if account.account_type == AccountType.stripe:
                                        with fragment.span(
                                            class_="badge badge-primary"
                                        ):
                                            fragment.text("Stripe")
                                    else:
                                        with fragment.span(
                                            class_="badge badge-secondary"
                                        ):
                                            fragment.text(
                                                account.account_type.value.title()
                                            )

                            with fragment.div():
                                with fragment.div(
                                    class_="text-sm text-base-content/60 mb-1"
                                ):
                                    fragment.text("Country")
                                with fragment.div(class_="font-semibold"):
                                    fragment.text(account.country or "N/A")

                            with fragment.div():
                                with fragment.div(
                                    class_="text-sm text-base-content/60 mb-1"
                                ):
                                    fragment.text("Currency")
                                with fragment.div(class_="font-semibold"):
                                    fragment.text(account.currency or "N/A")

                        # Stripe-specific info
                        if (
                            account.account_type == AccountType.stripe
                            and account.stripe_id
                        ):
                            with fragment.div(class_="pt-4 border-t border-base-300"):
                                with fragment.div(
                                    class_="flex items-center justify-between"
                                ):
                                    with fragment.div():
                                        with fragment.div(
                                            class_="text-sm text-base-content/60 mb-1"
                                        ):
                                            fragment.text("Stripe Account ID")
                                        with fragment.div(class_="font-mono text-sm"):
                                            fragment.text(account.stripe_id)

                                    with fragment.a(
                                        href=f"https://dashboard.stripe.com/connect/accounts/{account.stripe_id}",
                                        target="_blank",
                                        class_="btn btn-secondary btn-sm",
                                    ):
                                        fragment.text("Open in Stripe →")

                        # Account status
                        with fragment.div(class_="pt-4 border-t border-base-300"):
                            with fragment.div(class_="text-sm font-semibold mb-3"):
                                fragment.text("Account Status")

                            with fragment.div(class_="grid grid-cols-2 gap-3"):
                                # Charges enabled
                                charges_enabled = (
                                    account.is_charges_enabled
                                    if hasattr(account, "charges_enabled")
                                    else False
                                )
                                with fragment.div(class_="flex items-center gap-2"):
                                    icon = "Yes" if charges_enabled else "No"
                                    color = (
                                        "text-success"
                                        if charges_enabled
                                        else "text-error"
                                    )
                                    with fragment.span(class_=color):
                                        fragment.text(icon)
                                    fragment.text("Charges Enabled")

                                # Payouts enabled
                                payouts_enabled = (
                                    account.is_payouts_enabled
                                    if hasattr(account, "payouts_enabled")
                                    else False
                                )
                                with fragment.div(class_="flex items-center gap-2"):
                                    icon = "Yes" if payouts_enabled else "No"
                                    color = (
                                        "text-success"
                                        if payouts_enabled
                                        else "text-error"
                                    )
                                    with fragment.span(class_=color):
                                        fragment.text(icon)
                                    fragment.text("Payouts Enabled")

                        if (
                            account.account_type == AccountType.stripe
                            and account.stripe_id
                        ):
                            with fragment.div(class_="pt-4 border-t border-base-300"):
                                with fragment.div(class_="text-sm font-semibold mb-3"):
                                    fragment.text("Account Actions")

                                with fragment.div(class_="flex flex-wrap gap-2"):
                                    with button(
                                        variant="warning",
                                        size="sm",
                                        hx_get=str(
                                            request.url_for(
                                                "organizations-v2:disconnect_stripe_account",
                                                organization_id=self.org.id,
                                            )
                                        ),
                                        hx_target="#modal",
                                    ):
                                        fragment.text("Disconnect")

                                    with button(
                                        variant="error",
                                        size="sm",
                                        hx_get=str(
                                            request.url_for(
                                                "organizations-v2:delete_stripe_account",
                                                organization_id=self.org.id,
                                            )
                                        ),
                                        hx_target="#modal",
                                    ):
                                        fragment.text("Delete")

                else:
                    # No account
                    with fragment.div(class_="text-center py-8"):
                        with fragment.div(class_="text-base-content/60 mb-4"):
                            fragment.text("No payment account configured")

                        with button(
                            variant="primary",
                            hx_get=str(
                                request.url_for(
                                    "organizations-v2:setup_account",
                                    organization_id=self.org.id,
                                )
                            ),
                            hx_target="#modal",
                        ):
                            fragment.text("Setup Manual Account")

            # Payout settings (if manual account)
            if self.org.account and self.org.account.account_type != AccountType.stripe:
                with card(bordered=True):
                    with fragment.h3(class_="text-md font-bold mb-4"):
                        fragment.text("Manual Payout Settings")

                    with fragment.div(class_="space-y-3 text-sm"):
                        with fragment.div():
                            with fragment.span(class_="text-base-content/60"):
                                fragment.text("Processor Fees: ")
                            with fragment.span(class_="font-semibold"):
                                fragment.text("None (Manual)")

                        with fragment.div():
                            with fragment.span(class_="text-base-content/60"):
                                fragment.text("Payout Schedule: ")
                            with fragment.span(class_="font-semibold"):
                                fragment.text("Manual processing required")

            # Fee Credits section (only if account exists)
            if self.org.account:
                with card(bordered=True):
                    with fragment.div(class_="flex items-center justify-between mb-4"):
                        with fragment.h2(class_="text-lg font-bold"):
                            fragment.text("Fee Credits")
                        with button(
                            variant="primary",
                            size="sm",
                            hx_get=str(
                                request.url_for(
                                    "organizations-v2:grant_credit",
                                    organization_id=self.org.id,
                                )
                            ),
                            hx_target="#modal",
                        ):
                            fragment.text("Grant Credit")

                    # Available balance
                    with fragment.div(class_="mb-4 p-4 bg-base-200 rounded-lg"):
                        with fragment.div(class_="text-sm text-base-content/60 mb-1"):
                            fragment.text("Available Balance")
                        with fragment.div(class_="text-2xl font-bold text-success"):
                            fragment.text(_format_cents(self.available_balance))

                    # Credits table
                    if self.credits:
                        with fragment.div(class_="overflow-x-auto"):
                            with fragment.table(class_="table table-sm"):
                                with fragment.thead():
                                    with fragment.tr():
                                        with fragment.th():
                                            fragment.text("Status")
                                        with fragment.th():
                                            fragment.text("Title")
                                        with fragment.th():
                                            fragment.text("Amount")
                                        with fragment.th():
                                            fragment.text("Used")
                                        with fragment.th():
                                            fragment.text("Remaining")
                                        with fragment.th():
                                            fragment.text("Granted")
                                        with fragment.th():
                                            fragment.text("Expires")
                                        with fragment.th():
                                            fragment.text("Actions")
                                with fragment.tbody():
                                    for credit in self.credits:
                                        status_label, badge_class = _get_credit_status(
                                            credit
                                        )
                                        with fragment.tr():
                                            with fragment.td():
                                                with fragment.span(
                                                    class_=f"badge {badge_class}"
                                                ):
                                                    fragment.text(status_label)
                                            with fragment.td():
                                                fragment.text(credit.title)
                                            with fragment.td():
                                                fragment.text(
                                                    _format_cents(credit.amount)
                                                )
                                            with fragment.td():
                                                fragment.text(
                                                    _format_cents(credit.used)
                                                )
                                            with fragment.td(class_="font-semibold"):
                                                fragment.text(
                                                    _format_cents(credit.remaining)
                                                )
                                            with fragment.td(class_="text-xs"):
                                                fragment.text(
                                                    _format_date(credit.granted_at)
                                                )
                                            with fragment.td(class_="text-xs"):
                                                fragment.text(
                                                    _format_date(credit.expires_at)
                                                )
                                            with fragment.td():
                                                if status_label == "Active":
                                                    with button(
                                                        variant="error",
                                                        size="sm",
                                                        ghost=True,
                                                        hx_get=str(
                                                            request.url_for(
                                                                "organizations-v2:revoke_credit",
                                                                organization_id=self.org.id,
                                                                credit_id=credit.id,
                                                            )
                                                        ),
                                                        hx_target="#modal",
                                                    ):
                                                        fragment.text("Revoke")
                                                else:
                                                    fragment.text("—")

                                        # Notes row if present
                                        if credit.notes:
                                            with fragment.tr(class_="bg-base-200/50"):
                                                with fragment.td(
                                                    colspan="8",
                                                    class_="text-xs text-base-content/60 italic",
                                                ):
                                                    fragment.text(
                                                        f"Note: {credit.notes}"
                                                    )
                    else:
                        with fragment.div(
                            class_="text-center py-4 text-base-content/60"
                        ):
                            fragment.text("No credits granted yet")

            yield fragment


__all__ = ["AccountSection"]
