import contextlib
from collections.abc import Generator

from pydantic import ValidationError

from polar.backoffice.components import button, modal
from polar.backoffice.organizations.forms import DeleteStripeAccountForm
from polar.models import Account
from polar.backoffice.document import get_document


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

        
    doc = get_document()
            doc = get_document()
        form_data = {
            "stripe_account_id": "",
            "reason": "",
        }

        with modal("Delete Stripe Account", open=True):
            with doc.div(classes="flex flex-col gap-4"):
                with doc.p(classes="font-semibold text-error"):
                    doc.text("This will permanently delete the Stripe Connect account")

                with doc.div(classes="bg-base-200 p-4 rounded-lg"):
                    with doc.p(classes="mb-2"):
                        doc.text(
                            "This action will delete the Stripe Connect account on Stripe's side "
                            "and clear all capability flags. This cannot be undone."
                        )
                    with doc.p(classes="text-sm text-base-content/60"):
                        doc.text(f"Stripe Account ID: {self.account.stripe_id}")

                with DeleteStripeAccountForm.render(
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
                        with button(type="submit", variant="error"):
                            doc.text("Delete Stripe Account")

        yield


__all__ = ["DeleteStripeModal"]
