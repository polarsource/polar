import contextlib
from collections.abc import Generator

from pydantic import ValidationError
from tagflow import tag, text

from polar.backoffice.components import button, modal
from polar.backoffice.organizations.forms import DisconnectStripeAccountForm
from polar.models import Account


class DisconnectStripeModal:
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

        with modal("Disconnect Stripe Account", open=True):
            with tag.div(classes="flex flex-col gap-4"):
                with tag.p(classes="font-semibold text-warning"):
                    text("This will unlink the Stripe account from this organization.")

                with tag.div(classes="bg-base-200 p-4 rounded-lg"):
                    with tag.p(classes="mb-2"):
                        text(
                            "The Stripe connection will be removed, but the Stripe Account will remain and the user can access it. Use it on cases where the Stripe Account cannot be deleted."
                        )
                    with tag.p(classes="text-sm text-base-content/60"):
                        text(f"Current Stripe Account ID: {self.account.stripe_id}")

                with DisconnectStripeAccountForm.render(
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
                        with button(type="submit", variant="warning"):
                            text("Disconnect Stripe Account")

        yield


__all__ = ["DisconnectStripeModal"]
