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

    def create_link(self, stripe_id: str) -> stripe_lib.AccountLink:
        external_url = "http://127.0.0.1:3000/api/v1/integrations/stripe"  # TODO
        return stripe_lib.AccountLink.create(
            account=stripe_id,
            refresh_url=f"{external_url}/refresh",
            return_url=f"{external_url}/return",
            type="account_onboarding",
        )


stripe = StripeService()
