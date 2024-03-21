from typing import Literal
from uuid import UUID

from pydantic import Field

from polar.currency.schemas import CurrencyAmount
from polar.kit.schemas import Schema
from polar.pledge.schemas import MAXIMUM_AMOUNT


class DonationCurrencyAmount(CurrencyAmount):
    amount: int = Field(
        gt=0,
        le=MAXIMUM_AMOUNT,
        description="Amount in the currencies smallest unit (cents if currency is USD)",
    )


class DonationCreateStripePaymentIntent(Schema):
    to_organization_id: UUID
    email: str
    amount: DonationCurrencyAmount
    setup_future_usage: Literal["on_session"] | None = Field(
        None, description="If the payment method should be saved for future usage."
    )
    on_behalf_of_organization_id: UUID | None = Field(
        None,
        description="The organization to give credit to. The pledge will be paid by the authenticated user.",
    )


class DonationStripePaymentIntentMutationResponse(Schema):
    payment_intent_id: str
    amount: CurrencyAmount
    fee: CurrencyAmount
    amount_including_fee: CurrencyAmount
    client_secret: str | None = None


class DonationCreateFromPaymentIntent(Schema):
    payment_intent_id: str
