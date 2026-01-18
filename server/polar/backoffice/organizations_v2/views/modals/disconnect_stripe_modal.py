import contextlib
from collections.abc import Generator

from markupflow import Fragment
from pydantic import ValidationError

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
    def render(self) -> Generator[Fragment]:
        form_data = {
            "stripe_account_id": "",
            "reason": "",
        }

        fragment = Fragment()
        with modal("Disconnect Stripe Account", open=True) as page:
            with page.div(class_="flex flex-col gap-4"):
                with page.p(class_="font-semibold text-warning"):
                    page.text(
                        "This will unlink the Stripe account from this organization."
                    )

                with page.div(class_="bg-base-200 p-4 rounded-lg"):
                    with page.p(class_="mb-2"):
                        page.text(
                            "The Stripe connection will be removed, but the Stripe Account will remain and the user can access it. Use it on cases where the Stripe Account cannot be deleted."
                        )
                    with page.p(class_="text-sm text-base-content/60"):
                        page.text(
                            f"Current Stripe Account ID: {self.account.stripe_id}"
                        )

                with DisconnectStripeAccountForm.render(
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
                        with button(type="submit", variant="warning") as btn:
                            btn.text("Disconnect Stripe Account")

        yield fragment


__all__ = ["DisconnectStripeModal"]
