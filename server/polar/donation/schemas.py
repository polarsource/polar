import datetime
from collections.abc import Sequence
from typing import Literal, Self

from pydantic import UUID4, Field

from polar.currency.schemas import CurrencyAmount
from polar.enums import Platforms
from polar.kit.schemas import Schema
from polar.models import Donation as DonationModel
from polar.models.organization import Organization
from polar.models.user import User
from polar.pledge.schemas import MAXIMUM_AMOUNT


class DonationOrganization(Schema):
    id: UUID4
    platform: Platforms
    name: str
    avatar_url: str
    is_personal: bool


class DonationUser(Schema):
    id: UUID4
    public_name: str
    avatar_url: str


class Donation(Schema):
    id: UUID4
    amount: CurrencyAmount
    message: str | None
    donor: DonationOrganization | DonationUser | None
    email: str
    created_at: datetime.datetime

    @classmethod
    def from_db(
        cls,
        i: DonationModel,
    ) -> Self:
        model_donor = i.donor

        donor: DonationOrganization | DonationUser | None = None
        if isinstance(model_donor, User):
            donor = DonationUser.model_validate(model_donor)
        elif isinstance(model_donor, Organization):
            donor = DonationOrganization.model_validate(model_donor)

        return cls(
            id=i.id,
            amount=CurrencyAmount(currency="USD", amount=i.amount_received),
            message=i.message,
            donor=donor,
            created_at=i.created_at,
            email=i.email,
        )


class DonationCurrencyAmount(CurrencyAmount):
    amount: int = Field(
        gt=0,
        le=MAXIMUM_AMOUNT,
        description="Amount in the currencies smallest unit (cents if currency is USD)",
    )


class DonationCreateStripePaymentIntent(Schema):
    to_organization_id: UUID4
    email: str = Field(
        description="The donators email address. Receipts will be sent to this address."
    )
    amount: DonationCurrencyAmount
    setup_future_usage: Literal["on_session"] | None = Field(
        None, description="If the payment method should be saved for future usage."
    )
    on_behalf_of_organization_id: UUID4 | None = Field(
        None,
        description="The organization to give credit to. The pledge will be paid by the authenticated user.",
    )
    message: str | None = Field(None, description="Message included with the donation")


class DonationUpdateStripePaymentIntent(Schema):
    email: str = Field(
        description="The donators email address. Receipts will be sent to this address."
    )
    amount: DonationCurrencyAmount
    setup_future_usage: Literal["on_session"] | None = Field(
        None, description="If the payment method should be saved for future usage."
    )
    on_behalf_of_organization_id: UUID4 | None = Field(
        None,
        description="The organization to give credit to. The pledge will be paid by the authenticated user.",
    )
    message: str | None = Field(None, description="Message included with the donation")


class DonationStripePaymentIntentMutationResponse(Schema):
    payment_intent_id: str
    amount: CurrencyAmount
    fee: CurrencyAmount
    amount_including_fee: CurrencyAmount
    client_secret: str | None = None


class DonationCreateFromPaymentIntent(Schema):
    payment_intent_id: str


class DonationStatisticsPeriod(Schema):
    start_date: datetime.date
    end_date: datetime.date
    sum: int


class DonationStatistics(Schema):
    periods: Sequence[DonationStatisticsPeriod]
