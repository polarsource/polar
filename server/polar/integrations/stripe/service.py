import stripe as stripe_lib
from uuid import UUID

from polar.config import settings

stripe_lib.api_key = settings.STRIPE_SECRET_KEY


class StripeService(object):
    def create_intent(self, amount: int, issue_id: UUID) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.create(
            amount=amount,
            currency="USD",
            transfer_group=f"{issue_id}",
        )

    def modify_intent(self, id: str, amount: int) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.modify(
            id,
            amount=amount,
        )

    def retrieve_intent(self, id: str) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.retrieve(id)

    def create_account(self) -> stripe_lib.Account:
        return stripe_lib.Account.create(type="express")


stripe = StripeService()
