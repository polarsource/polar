"""Payout account section showing the PayoutAccount entity (payment processor details)."""

import contextlib
from collections.abc import Generator

from fastapi import Request
from tagflow import tag, text

from polar.enums import PayoutAccountType
from polar.models import Organization

from ....components import button, card


def _yes_no(value: bool) -> tuple[str, str]:
    """Return (label, css_class) for a boolean flag."""
    if value:
        return ("Yes", "text-success")
    return ("No", "text-error")


class PayoutAccountSection:
    """Render the payout account section showing the PayoutAccount entity."""

    def __init__(self, organization: Organization):
        self.org = organization

    @contextlib.contextmanager
    def render(self, request: Request) -> Generator[None]:
        """Render the payout account section."""

        with tag.div(classes="space-y-6"):
            with card(bordered=True):
                with tag.h2(classes="text-lg font-bold mb-4"):
                    text("Payout Account")

                if self.org.payout_account:
                    payout_account = self.org.payout_account

                    with tag.div(classes="space-y-4"):
                        # Top row: type badge + country + currency
                        with tag.div(classes="grid grid-cols-2 gap-4"):
                            with tag.div():
                                with tag.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    text("Type")
                                with tag.div():
                                    if payout_account.type == PayoutAccountType.stripe:
                                        with tag.span(classes="badge badge-primary"):
                                            text("Stripe")
                                    else:
                                        with tag.span(classes="badge badge-secondary"):
                                            text(payout_account.type.get_display_name())

                            with tag.div():
                                with tag.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    text("Country")
                                with tag.div(classes="font-semibold uppercase"):
                                    text(payout_account.country or "N/A")

                            with tag.div():
                                with tag.div(
                                    classes="text-sm text-base-content/60 mb-1"
                                ):
                                    text("Currency")
                                with tag.div(classes="font-semibold uppercase"):
                                    text(payout_account.currency or "N/A")

                            if payout_account.email:
                                with tag.div():
                                    with tag.div(
                                        classes="text-sm text-base-content/60 mb-1"
                                    ):
                                        text("Email")
                                    with tag.div(classes="text-sm"):
                                        text(payout_account.email)

                        # Stripe-specific details
                        if (
                            payout_account.type == PayoutAccountType.stripe
                            and payout_account.stripe_id
                        ):
                            with tag.div(classes="pt-4 border-t border-base-300"):
                                with tag.div(
                                    classes="flex items-center justify-between mb-3"
                                ):
                                    with tag.div():
                                        with tag.div(
                                            classes="text-sm text-base-content/60 mb-1"
                                        ):
                                            text("Stripe Account ID")
                                        with tag.div(classes="font-mono text-sm"):
                                            text(payout_account.stripe_id)

                                    with tag.a(
                                        href=f"https://dashboard.stripe.com/connect/accounts/{payout_account.stripe_id}",
                                        target="_blank",
                                        classes="btn btn-secondary btn-sm",
                                    ):
                                        text("Open in Stripe →")

                                # Stripe capability flags
                                with tag.div(classes="grid grid-cols-3 gap-3 mt-2"):
                                    for label, value in [
                                        (
                                            "Details Submitted",
                                            payout_account.is_details_submitted,
                                        ),
                                        (
                                            "Charges Enabled",
                                            payout_account.is_charges_enabled,
                                        ),
                                        (
                                            "Payouts Enabled",
                                            payout_account.is_payouts_enabled,
                                        ),
                                    ]:
                                        flag_text, flag_color = _yes_no(value)
                                        with tag.div(classes="flex items-center gap-2"):
                                            with tag.span(classes=flag_color):
                                                text(flag_text)
                                            with tag.span(
                                                classes="text-sm text-base-content/70"
                                            ):
                                                text(label)

                        # Actions
                        with tag.div(
                            classes="pt-4 border-t border-base-300 flex flex-wrap gap-2"
                        ):
                            with tag.div(classes="text-sm font-semibold mb-2 w-full"):
                                text("Actions")

                            if (
                                payout_account.type == PayoutAccountType.stripe
                                and payout_account.stripe_id
                            ):
                                with button(
                                    variant="warning",
                                    size="sm",
                                    hx_post=str(
                                        request.url_for(
                                            "organizations:resync_stripe_account",
                                            organization_id=self.org.id,
                                        )
                                    ),
                                    hx_confirm="Resync this Stripe account from Stripe's API?",
                                ):
                                    text("Resync from Stripe")

                            with button(
                                variant="error",
                                size="sm",
                                hx_get=str(
                                    request.url_for(
                                        "organizations:delete_payout_account",
                                        organization_id=self.org.id,
                                    )
                                ),
                                hx_target="#modal",
                            ):
                                text("Delete Payout Account")

                else:
                    # No payout account configured
                    with tag.div(classes="text-center py-8"):
                        with tag.div(classes="text-base-content/60 mb-4"):
                            text("No payout account configured")

                        with button(
                            variant="primary",
                            hx_get=str(
                                request.url_for(
                                    "organizations:setup_account",
                                    organization_id=self.org.id,
                                )
                            ),
                            hx_target="#modal",
                        ):
                            text("Setup Manual Account")

            yield
