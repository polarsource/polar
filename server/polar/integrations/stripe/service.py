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
            automatic_payment_methods={
                "enabled": True,
            },
            transfer_group=f"{issue_id}",
        )


stripe = StripeService()
