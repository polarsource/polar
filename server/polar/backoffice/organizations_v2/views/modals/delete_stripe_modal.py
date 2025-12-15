import contextlib
from collections.abc import Generator

from pydantic import ValidationError
from tagflow import tag, text

from polar.backoffice.components import button, modal
from polar.backoffice.organizations.forms import DeleteStripeAccountForm
from polar.models import Account


class DeleteStripeModal:
    def __init__(
        self,
        account: Account,
        form_action: str,
        validation_error: ValidationError | None = None,
    ):
        self.account = account
        self.form_action = form_action
        self.validation_error = validation_error

    @contextlib.contextmanager
    def render(self) -> Generator[None]:
        form_data = {
            "stripe_account_id": "",
            "reason": "",
        }

        with modal("Delete Stripe Account", open=True):
            with tag.div(classes="flex flex-col gap-4"):
                with tag.p(classes="font-semibold text-error"):
                    text("This will permanently delete the Stripe Connect account")

                with tag.div(classes="bg-base-200 p-4 rounded-lg"):
                    with tag.p(classes="mb-2"):
                        text(
                            "This action will delete the Stripe Connect account on Stripe's side "
                            "and clear all capability flags. This cannot be undone."
                        )
                    with tag.p(classes="text-sm text-base-content/60"):
                        text(f"Stripe Account ID: {self.account.stripe_id}")

                with DeleteStripeAccountForm.render(
                    data=form_data,
                    validation_error=self.validation_error,
                    hx_post=self.form_action,
                    hx_target="#modal",
                    classes="space-y-4",
                ):
                    with tag.div(classes="modal-action pt-6 border-t border-base-200"):
                        with tag.form(method="dialog"):
                            with button(ghost=True):
                                text("Cancel")
                        with button(type="submit", variant="error"):
                            text("Delete Stripe Account")

        yield


__all__ = ["DeleteStripeModal"]
