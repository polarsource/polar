import stripe as stripe_lib
from decimal import Decimal
from uuid import UUID

from polar.config import settings

stripe_lib.api_key = settings.STRIPE_SECRET_KEY


class StripeService(object):
    def create_intent(
        self, amount: Decimal, issue_id: UUID
    ) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.create(
            amount=amount * 100,
            currency="USD",
            transfer_group=f"{issue_id}",
        )

    def modify_intent(self, id: str, amount: Decimal) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.modify(
            id,
            amount=amount * 100,
        )

    def retrieve_intent(self, id: str) -> stripe_lib.PaymentIntent:
        return stripe_lib.PaymentIntent.retrieve(id)


stripe = StripeService()
