import contextlib
from collections.abc import Generator

from markupflow import Fragment
from pydantic import ValidationError

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
    def render(self) -> Generator[Fragment]:
        form_data = {
            "stripe_account_id": "",
            "reason": "",
        }

        fragment = Fragment()
        with modal("Delete Stripe Account", open=True) as page:
            with page.div(class_="flex flex-col gap-4"):
                with page.p(class_="font-semibold text-error"):
                    page.text("This will permanently delete the Stripe Connect account")

                with page.div(class_="bg-base-200 p-4 rounded-lg"):
                    with page.p(class_="mb-2"):
                        page.text(
                            "This action will delete the Stripe Connect account on Stripe's side "
                            "and clear all capability flags. This cannot be undone."
                        )
                    with page.p(class_="text-sm text-base-content/60"):
                        page.text(f"Stripe Account ID: {self.account.stripe_id}")

                with DeleteStripeAccountForm.render(
                    data=form_data,
                    validation_error=self.validation_error,
                    hx_post=self.form_action,
                    hx_target="#modal",
                    class_="space-y-4",
                ) as form:
                    with form.div(class_="modal-action pt-6 border-t border-base-200"):
                        with form.form(method="dialog"):
                            with button(ghost=True) as btn:
                                btn.text("Cancel")
                        with button(type="submit", variant="error") as btn:
                            btn.text("Delete Stripe Account")

        yield fragment


__all__ = ["DeleteStripeModal"]
