"""Account section with payment account details."""

import contextlib
from collections.abc import Generator, Sequence
from datetime import UTC, datetime

from fastapi import Request
from polar.backoffice.document import get_document

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
    def render(self, request: Request) -> Generator[None]:
        """Render the account section."""

        with doc.div(classes="space-y-6"):
            # Account details card
            with card(bordered=True):
                with doc.h2(classes="text-lg font-bold mb-4"):
                    doc.text("Payment Account")

                if self.org.account:
                    account = self.org.account

                    # Account type and status
                    with doc.div(classes="space-y-4"):
                        with doc.div(classes="grid grid-cols-2 gap-4"):
                            with doc.div():
                                with doc.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    doc.text("Account ID")
                                with doc.div(classes="font-mono text-sm"):
                                    doc.text(str(account.id))

                            with doc.div():
                                with doc.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    doc.text("Type")
                                with doc.div(classes="font-semibold"):
                                    if account.account_type == AccountType.stripe:
                                        with doc.span(classes="badge badge-primary"):
                                            doc.text("Stripe")
                                    else:
                                        with doc.span(classes="badge badge-secondary"):
                                            doc.text(account.account_type.value.title())

                            with doc.div():
                                with doc.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    doc.text("Country")
                                with doc.div(classes="font-semibold"):
                                    doc.text(account.country or "N/A")

                            with doc.div():
                                with doc.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    doc.text("Currency")
                                with doc.div(classes="font-semibold"):
                                    doc.text(account.currency or "N/A")

                        # Stripe-specific info
                        if (
                            account.account_type == AccountType.stripe
                            and account.stripe_id
                        ):
                            with doc.div(classes="pt-4 border-t border-base-300"):
                                with doc.div(
                                    classes="flex items-center justify-between"
                                ):
                                    with doc.div():
                                        with doc.div(
                                            classes="text-sm text-base-content/60 mb-1"
                                        ):
                                            doc.text("Stripe Account ID")
                                        with doc.div(classes="font-mono text-sm"):
                                            doc.text(account.stripe_id)

                                    with doc.a(
                                        href=f"https://dashboard.stripe.com/connect/accounts/{account.stripe_id}",
                                        target="_blank",
                                        classes="btn btn-secondary btn-sm",
                                    ):
                                        doc.text("Open in Stripe →")

                        # Account status
                        with doc.div(classes="pt-4 border-t border-base-300"):
                            with doc.div(classes="text-sm font-semibold mb-3"):
                                doc.text("Account Status")

                            with doc.div(classes="grid grid-cols-2 gap-3"):
                                # Charges enabled
                                charges_enabled = (
                                    account.is_charges_enabled
                                    if hasattr(account, "charges_enabled")
                                    else False
                                )
                                with doc.div(classes="flex items-center gap-2"):
                                    icon = "Yes" if charges_enabled else "No"
                                    color = (
                                        "text-success"
                                        if charges_enabled
                                        else "text-error"
                                    )
                                    with doc.span(classes=color):
                                        doc.text(icon)
                                    doc.text("Charges Enabled")

                                # Payouts enabled
                                payouts_enabled = (
                                    account.is_payouts_enabled
                                    if hasattr(account, "payouts_enabled")
                                    else False
                                )
                                with doc.div(classes="flex items-center gap-2"):
                                    icon = "Yes" if payouts_enabled else "No"
                                    color = (
                                        "text-success"
                                        if payouts_enabled
                                        else "text-error"
                                    )
                                    with doc.span(classes=color):
                                        doc.text(icon)
                                    doc.text("Payouts Enabled")

                        if (
                            account.account_type == AccountType.stripe
                            and account.stripe_id
                        ):
                            with doc.div(classes="pt-4 border-t border-base-300"):
                                with doc.div(classes="text-sm font-semibold mb-3"):
                                    doc.text("Account Actions")

                                with doc.div(classes="flex flex-wrap gap-2"):
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
                                        doc.text("Disconnect")

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
                                        doc.text("Delete")

                else:
                    # No account
                    with doc.div(classes="text-center py-8"):
                        with doc.div(classes="text-base-content/60 mb-4"):
                            doc.text("No payment account configured")

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
                            doc.text("Setup Manual Account")

            # Payout settings (if manual account)
            if self.org.account and self.org.account.account_type != AccountType.stripe:
                with card(bordered=True):
                    with doc.h3(classes="text-md font-bold mb-4"):
                        doc.text("Manual Payout Settings")

                    with doc.div(classes="space-y-3 text-sm"):
                        with doc.div():
                            with doc.span(classes="text-base-content/60"):
                                doc.text("Processor Fees: ")
                            with doc.span(classes="font-semibold"):
                                doc.text("None (Manual)")

                        with doc.div():
                            with doc.span(classes="text-base-content/60"):
                                doc.text("Payout Schedule: ")
                            with doc.span(classes="font-semibold"):
                                doc.text("Manual processing required")

            # Fee Credits section (only if account exists)
            if self.org.account:
                with card(bordered=True):
                    with doc.div(classes="flex items-center justify-between mb-4"):
                        with doc.h2(classes="text-lg font-bold"):
                            doc.text("Fee Credits")
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
                            doc.text("Grant Credit")

                    # Available balance
                    with doc.div(classes="mb-4 p-4 bg-base-200 rounded-lg"):
                        with doc.div(classes="text-sm text-base-content/60 mb-1"):
                            doc.text("Available Balance")
                        with doc.div(classes="text-2xl font-bold text-success"):
                            doc.text(_format_cents(self.available_balance))

                    # Credits table
                    if self.credits:
                        with doc.div(classes="overflow-x-auto"):
                            with doc.table(classes="table table-sm"):
                                with doc.thead():
                                    with doc.tr():
                                        with doc.th():
                                            doc.text("Status")
                                        with doc.th():
                                            doc.text("Title")
                                        with doc.th():
                                            doc.text("Amount")
                                        with doc.th():
                                            doc.text("Used")
                                        with doc.th():
                                            doc.text("Remaining")
                                        with doc.th():
                                            doc.text("Granted")
                                        with doc.th():
                                            doc.text("Expires")
                                        with doc.th():
                                            doc.text("Actions")
                                with doc.tbody():
                                    for credit in self.credits:
                                        status_label, badge_class = _get_credit_status(
                                            credit
                                        )
                                        with doc.tr():
                                            with doc.td():
                                                with doc.span(
                                                    classes=f"badge {badge_class}"
                                                ):
                                                    doc.text(status_label)
                                            with doc.td():
                                                doc.text(credit.title)
                                            with doc.td():
                                                doc.text(_format_cents(credit.amount))
                                            with doc.td():
                                                doc.text(_format_cents(credit.used))
                                            with doc.td(classes="font-semibold"):
                                                doc.text(_format_cents(credit.remaining))
                                            with doc.td(classes="text-xs"):
                                                doc.text(_format_date(credit.granted_at))
                                            with doc.td(classes="text-xs"):
                                                doc.text(_format_date(credit.expires_at))
                                            with doc.td():
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
                                                        doc.text("Revoke")
                                                else:
                                                    doc.text("—")

                                        # Notes row if present
                                        if credit.notes:
                                            with doc.tr(classes="bg-base-200/50"):
                                                with doc.td(
                                                    colspan="8",
                                                    classes="text-xs text-base-content/60 italic",
                                                ):
                                                    doc.text(f"Note: {credit.notes}")
                    else:
                        with doc.div(classes="text-center py-4 text-base-content/60"):
                            doc.text("No credits granted yet")

            yield


__all__ = ["AccountSection"]
