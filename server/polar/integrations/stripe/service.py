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

    def retrieve_account(self, id: str) -> stripe_lib.Account:
        return stripe_lib.Account.retrieve(id)

    def retrieve_balance(self, id: str) -> int:
        # Return available USD on the specified account
        balance = stripe_lib.Balance.retrieve(stripe_account=id)
        for b in balance["available"]:
            if b["currency"] == "usd":
                return b["amount"]
        return 0

    def create_link(
        self, stripe_id: str, appendix: str | None = None
    ) -> stripe_lib.AccountLink:
        refresh_url = settings.generate_external_url("/integrations/stripe/refresh") + (
            appendix or ""
        )
        return_url = settings.generate_external_url("/integrations/stripe/return") + (
            appendix or ""
        )
        return stripe_lib.AccountLink.create(
            account=stripe_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding",
        )


stripe = StripeService()
