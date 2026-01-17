import contextlib
from collections.abc import Generator

from pydantic import ValidationError

from polar.backoffice.components import button, modal
from polar.backoffice.organizations.forms import DisconnectStripeAccountForm
from polar.models import Account
from polar.backoffice.document import get_document


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

        doc = get_document()        doc = get_document()
        form_data = {
            "stripe_account_id": "",
            "reason": "",
        }

        with modal("Disconnect Stripe Account", open=True):
            with doc.div(classes="flex flex-col gap-4"):
                with doc.p(classes="font-semibold text-warning"):
                    doc.text(
                        "This will unlink the Stripe account from this organization."
                    )

                with doc.div(classes="bg-base-200 p-4 rounded-lg"):
                    with doc.p(classes="mb-2"):
                        doc.text(
                            "The Stripe connection will be removed, but the Stripe Account will remain and the user can access it. Use it on cases where the Stripe Account cannot be deleted."
                        )
                    with doc.p(classes="text-sm text-base-content/60"):
                        doc.text(f"Current Stripe Account ID: {self.account.stripe_id}")

                with DisconnectStripeAccountForm.render(
                    data=form_data,
                    validation_error=self.validation_error,
                    hx_post=self.form_action,
                    hx_target="#modal",
                    classes="space-y-4",
                ):
                    with doc.div(classes="modal-action pt-6 border-t border-base-200"):
                        with doc.form(method="dialog"):
                            with button(ghost=True):
                                doc.text("Cancel")
                        with button(type="submit", variant="warning"):
                            doc.text("Disconnect Stripe Account")

        yield


__all__ = ["DisconnectStripeModal"]
