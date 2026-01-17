import contextlib
from collections.abc import Generator

from polar.backoffice.components import confirmation_dialog
from polar.backoffice.document import get_document
from polar.models import User


class DeleteIdentityVerificationModal:
    def __init__(self, user: User, form_action: str):
        self.user = user
        self.form_action = form_action

    @contextlib.contextmanager
    def render(self) -> Generator[None]:

        doc = get_document()        doc = get_document()
        with confirmation_dialog(
            "Delete Identity Verification",
            "Are you sure you want to delete this user's identity verification? "
            "This will reset their verification status to unverified and redact "
            "all personal data from Stripe. This action cannot be undone.",
            variant="error",
            confirm_text="Delete Verification",
            open=True,
        ):
            doc.attr("hx-post", self.form_action)
            doc.attr("hx-target", "#modal")
            doc.attr("hx-vals", '{"confirm": "true"}')

        yield


__all__ = ["DeleteIdentityVerificationModal"]
