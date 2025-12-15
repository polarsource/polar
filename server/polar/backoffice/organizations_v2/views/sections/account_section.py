"""Account section with payment account details."""

import contextlib
from collections.abc import Generator

from fastapi import Request
from tagflow import tag, text

from polar.enums import AccountType
from polar.models import Organization

from ....components import button, card


class AccountSection:
    """Render the account section with payment details."""

    def __init__(self, organization: Organization):
        self.org = organization

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        """Render the account section."""

        with tag.div(classes="space-y-6"):
            # Account details card
            with card(bordered=True):
                with tag.h2(classes="text-lg font-bold mb-4"):
                    text("Payment Account")

                if self.org.account:
                    account = self.org.account

                    # Account type and status
                    with tag.div(classes="space-y-4"):
                        with tag.div(classes="grid grid-cols-2 gap-4"):
                            with tag.div():
                                with tag.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    text("Account ID")
                                with tag.div(classes="font-mono text-sm"):
                                    text(str(account.id))

                            with tag.div():
                                with tag.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    text("Type")
                                with tag.div(classes="font-semibold"):
                                    if account.account_type == AccountType.stripe:
                                        with tag.span(classes="badge badge-primary"):
                                            text("Stripe")
                                    else:
                                        with tag.span(classes="badge badge-secondary"):
                                            text(account.account_type.value.title())

                            with tag.div():
                                with tag.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    text("Country")
                                with tag.div(classes="font-semibold"):
                                    text(account.country or "N/A")

                            with tag.div():
                                with tag.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    text("Currency")
                                with tag.div(classes="font-semibold"):
                                    text(account.currency or "N/A")

                        # Stripe-specific info
                        if (
                            account.account_type == AccountType.stripe
                            and account.stripe_id
                        ):
                            with tag.div(classes="pt-4 border-t border-base-300"):
                                with tag.div(
                                    classes="flex items-center justify-between"
                                ):
                                    with tag.div():
                                        with tag.div(
                                            classes="text-sm text-base-content/60 mb-1"
                                        ):
                                            text("Stripe Account ID")
                                        with tag.div(classes="font-mono text-sm"):
                                            text(account.stripe_id)

                                    with tag.a(
                                        href=f"https://dashboard.stripe.com/connect/accounts/{account.stripe_id}",
                                        target="_blank",
                                        classes="btn btn-secondary btn-sm",
                                    ):
                                        text("Open in Stripe →")

                        # Account status
                        with tag.div(classes="pt-4 border-t border-base-300"):
                            with tag.div(classes="text-sm font-semibold mb-3"):
                                text("Account Status")

                            with tag.div(classes="grid grid-cols-2 gap-3"):
                                # Charges enabled
                                charges_enabled = (
                                    account.charges_enabled
                                    if hasattr(account, "charges_enabled")
                                    else False
                                )
                                with tag.div(classes="flex items-center gap-2"):
                                    icon = "Yes" if charges_enabled else "No"
                                    color = (
                                        "text-success"
                                        if charges_enabled
                                        else "text-error"
                                    )
                                    with tag.span(classes=color):
                                        text(icon)
                                    text("Charges Enabled")

                                # Payouts enabled
                                payouts_enabled = (
                                    account.payouts_enabled
                                    if hasattr(account, "payouts_enabled")
                                    else False
                                )
                                with tag.div(classes="flex items-center gap-2"):
                                    icon = "Yes" if payouts_enabled else "No"
                                    color = (
                                        "text-success"
                                        if payouts_enabled
                                        else "text-error"
                                    )
                                    with tag.span(classes=color):
                                        text(icon)
                                    text("Payouts Enabled")

                        if (
                            account.account_type == AccountType.stripe
                            and account.stripe_id
                        ):
                            with tag.div(classes="pt-4 border-t border-base-300"):
                                with tag.div(classes="text-sm font-semibold mb-3"):
                                    text("Account Actions")

                                with tag.div(classes="flex flex-wrap gap-2"):
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
                                        text("Disconnect")

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
                                        text("Delete")

                else:
                    # No account
                    with tag.div(classes="text-center py-8"):
                        with tag.div(classes="text-base-content/60 mb-4"):
                            text("No payment account configured")

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
                            text("Setup Manual Account")

            # Payout settings (if manual account)
            if self.org.account and self.org.account.account_type != AccountType.stripe:
                with card(bordered=True):
                    with tag.h3(classes="text-md font-bold mb-4"):
                        text("Manual Payout Settings")

                    with tag.div(classes="space-y-3 text-sm"):
                        with tag.div():
                            with tag.span(classes="text-base-content/60"):
                                text("Processor Fees: ")
                            with tag.span(classes="font-semibold"):
                                text("None (Manual)")

                        with tag.div():
                            with tag.span(classes="text-base-content/60"):
                                text("Payout Schedule: ")
                            with tag.span(classes="font-semibold"):
                                text("Manual processing required")

            yield


__all__ = ["AccountSection"]
