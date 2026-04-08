"""Account section showing the pure Account entity (financial: fees, credits, balance)."""

import contextlib
from collections.abc import Generator, Sequence
from datetime import UTC, datetime

from fastapi import Request
from tagflow import tag, text

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
    """Render the account section showing the pure Account entity."""

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

        with tag.div(classes="space-y-6"):
            # Account details card
            with card(bordered=True):
                with tag.div(classes="flex items-center justify-between mb-4"):
                    with tag.h2(classes="text-lg font-bold"):
                        text("Account")
                    if self.org.account:
                        with tag.a(
                            href=f"{request.url_for('payouts:list')}?query={self.org.account.id}",
                            classes="btn btn-secondary btn-sm",
                        ):
                            text("View Payouts →")

                if self.org.account:
                    account = self.org.account
                    basis_points, fixed_cents = account.platform_fee

                    with tag.div(classes="space-y-4"):
                        # Top row: ID + currency
                        with tag.div(classes="grid grid-cols-2 gap-4"):
                            with tag.div():
                                with tag.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    text("Account ID")
                                with tag.div(classes="font-mono text-sm break-all"):
                                    text(str(account.id))

                            with tag.div():
                                with tag.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    text("Currency")
                                with tag.div(classes="font-semibold uppercase"):
                                    text(account.currency or "N/A")

                        # Fees row
                        with tag.div(classes="pt-4 border-t border-base-300"):
                            with tag.div(classes="text-sm font-semibold mb-3"):
                                text("Platform Fees")

                            with tag.div(classes="grid grid-cols-2 gap-4"):
                                with tag.div():
                                    with tag.div(
                                        classes="text-sm text-base-content/60 mb-1"
                                    ):
                                        text("Processor Fees Applicable")
                                    if account.processor_fees_applicable:
                                        with tag.span(classes="badge badge-success"):
                                            text("Yes")
                                    else:
                                        with tag.span(classes="badge badge-neutral"):
                                            text("No")

                                with tag.div():
                                    with tag.div(
                                        classes="text-sm text-base-content/60 mb-1"
                                    ):
                                        text("Platform Fee Rate")
                                    with tag.div(classes="font-semibold"):
                                        text(
                                            f"{basis_points / 100:.2f}% + {_format_cents(fixed_cents)}"
                                        )

                else:
                    # No account
                    with tag.div(classes="text-center py-8"):
                        with tag.div(classes="text-base-content/60 mb-2"):
                            text("No account configured")

            # Fee Credits section (only if account exists)
            if self.org.account:
                with card(bordered=True):
                    with tag.div(classes="flex items-center justify-between mb-4"):
                        with tag.h2(classes="text-lg font-bold"):
                            text("Fee Credits")
                        with button(
                            variant="primary",
                            size="sm",
                            hx_get=str(
                                request.url_for(
                                    "organizations:grant_credit",
                                    organization_id=self.org.id,
                                )
                            ),
                            hx_target="#modal",
                        ):
                            text("Grant Credit")

                    # Available balance
                    with tag.div(classes="mb-4 p-4 bg-base-200 rounded-lg"):
                        with tag.div(classes="text-sm text-base-content/60 mb-1"):
                            text("Available Balance")
                        with tag.div(classes="text-2xl font-bold text-success"):
                            text(_format_cents(self.available_balance))

                    # Credits table
                    if self.credits:
                        with tag.div(classes="overflow-x-auto"):
                            with tag.table(classes="table table-sm"):
                                with tag.thead():
                                    with tag.tr():
                                        with tag.th():
                                            text("Status")
                                        with tag.th():
                                            text("Title")
                                        with tag.th():
                                            text("Amount")
                                        with tag.th():
                                            text("Used")
                                        with tag.th():
                                            text("Remaining")
                                        with tag.th():
                                            text("Granted")
                                        with tag.th():
                                            text("Expires")
                                        with tag.th():
                                            text("Actions")
                                with tag.tbody():
                                    for credit in self.credits:
                                        status_label, badge_class = _get_credit_status(
                                            credit
                                        )
                                        with tag.tr():
                                            with tag.td():
                                                with tag.span(
                                                    classes=f"badge {badge_class}"
                                                ):
                                                    text(status_label)
                                            with tag.td():
                                                text(credit.title)
                                            with tag.td():
                                                text(_format_cents(credit.amount))
                                            with tag.td():
                                                text(_format_cents(credit.used))
                                            with tag.td(classes="font-semibold"):
                                                text(_format_cents(credit.remaining))
                                            with tag.td(classes="text-xs"):
                                                text(_format_date(credit.granted_at))
                                            with tag.td(classes="text-xs"):
                                                text(_format_date(credit.expires_at))
                                            with tag.td():
                                                if status_label == "Active":
                                                    with button(
                                                        variant="error",
                                                        size="sm",
                                                        ghost=True,
                                                        hx_get=str(
                                                            request.url_for(
                                                                "organizations:revoke_credit",
                                                                organization_id=self.org.id,
                                                                credit_id=credit.id,
                                                            )
                                                        ),
                                                        hx_target="#modal",
                                                    ):
                                                        text("Revoke")
                                                else:
                                                    text("—")

                                        # Notes row if present
                                        if credit.notes:
                                            with tag.tr(classes="bg-base-200/50"):
                                                with tag.td(
                                                    colspan="8",
                                                    classes="text-xs text-base-content/60 italic",
                                                ):
                                                    text(f"Note: {credit.notes}")
                    else:
                        with tag.div(classes="text-center py-4 text-base-content/60"):
                            text("No credits granted yet")

            yield
