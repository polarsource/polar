"""Modal for confirming deletion of a payout account."""

import contextlib
from collections.abc import Generator

from pydantic import ValidationError
from tagflow import tag, text

from polar.backoffice.components import button, modal
from polar.enums import PayoutAccountType
from polar.models import PayoutAccount


class DeletePayoutAccountModal:
    def __init__(
        self,
        payout_account: PayoutAccount,
        form_action: str,
        validation_error: ValidationError | None = None,
    ):
        self.payout_account = payout_account
        self.form_action = form_action
        self.validation_error = validation_error

    @contextlib.contextmanager
    def render(self) -> Generator[None]:
        with modal("Delete Payout Account", open=True):
            with tag.form(
                method="post",
                hx_post=self.form_action,
                hx_target="#modal",
                classes="flex flex-col gap-4",
            ):
                # Warning banner
                with tag.div(classes="alert alert-error"):
                    with tag.span(classes="font-semibold"):
                        text(
                            "This will permanently delete the payout account."
                            " This action cannot be undone."
                        )

                # Account summary
                with tag.div(classes="bg-base-200 p-4 rounded-lg space-y-2"):
                    with tag.div(classes="flex items-center gap-2"):
                        with tag.span(classes="text-sm text-base-content/60"):
                            text("Type:")
                        if self.payout_account.type == PayoutAccountType.stripe:
                            with tag.span(classes="badge badge-primary badge-sm"):
                                text("Stripe")
                        else:
                            with tag.span(classes="badge badge-secondary badge-sm"):
                                text(self.payout_account.type.get_display_name())

                    if (
                        self.payout_account.type == PayoutAccountType.stripe
                        and self.payout_account.stripe_id
                    ):
                        with tag.div(classes="flex items-center gap-2"):
                            with tag.span(classes="text-sm text-base-content/60"):
                                text("Stripe ID:")
                            with tag.span(classes="font-mono text-sm"):
                                text(self.payout_account.stripe_id)

                    with tag.div(classes="flex items-center gap-2"):
                        with tag.span(classes="text-sm text-base-content/60"):
                            text("Country / Currency:")
                        with tag.span(classes="font-semibold text-sm uppercase"):
                            text(
                                f"{self.payout_account.country} / {self.payout_account.currency}"
                            )

                # Reason field
                with tag.div(classes="form-control w-full"):
                    with tag.label(classes="label"):
                        with tag.span(classes="label-text font-semibold"):
                            text("Reason")
                        with tag.span(classes="label-text-alt text-error"):
                            text("Required")

                    with tag.textarea(
                        name="reason",
                        placeholder="Describe why this payout account is being deleted…",
                        classes="textarea textarea-bordered w-full min-h-24",
                        required=True,
                    ):
                        pass

                    if self.validation_error:
                        for error in self.validation_error.errors():
                            if "reason" in error.get("loc", ()):
                                with tag.div(classes="label"):
                                    with tag.span(classes="label-text-alt text-error"):
                                        text(error["msg"])

                # Actions
                with tag.div(
                    classes="modal-action pt-6 border-t border-base-200 flex justify-end gap-2"
                ):
                    with tag.div(classes="mr-auto"):
                        pass  # spacer

                    with tag.form(method="dialog"):
                        with button(ghost=True, type="submit"):
                            text("Cancel")

                    with button(variant="error", type="submit"):
                        text("Delete Payout Account")

        yield


__all__ = ["DeletePayoutAccountModal"]
