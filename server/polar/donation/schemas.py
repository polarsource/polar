import datetime
from collections.abc import Sequence
from typing import Annotated, Literal

from pydantic import UUID4, Field

from polar.enums import Platforms
from polar.issue.schemas import Issue
from polar.kit.schemas import EmailStrDNS, IDSchema, Schema, TimestampedSchema

# Ref: https://stripe.com/docs/api/payment_intents/object#payment_intent_object-amount
MAXIMUM_PRICE_AMOUNT = 99999999


DonationAmount = Annotated[
    int, Field(..., gt=0, le=MAXIMUM_PRICE_AMOUNT, description="The amount in cents.")
]
DonationCurrency = Annotated[
    str,
    Field(
        default="usd",
        pattern="usd",
        description="The currency. Currently, only `usd` is supported.",
    ),
]


class DonorBase(Schema):
    def get_name(self) -> str:
        raise NotImplementedError()


class DonationOrganization(DonorBase):
    id: UUID4
    platform: Platforms
    name: str
    avatar_url: str
    is_personal: bool

    def get_name(self) -> str:
        return self.name


class DonationUser(DonorBase):
    id: UUID4
    public_name: str
    avatar_url: str | None

    def get_name(self) -> str:
        return self.public_name


class Donation(IDSchema, TimestampedSchema):
    amount: int
    currency: str
    message: str | None
    donor: DonationOrganization | DonationUser | None = None
    email: str
    issue: Issue | None = None


class DonationCreateStripePaymentIntent(Schema):
    to_organization_id: UUID4
    email: EmailStrDNS = Field(
        description="The donators email address. Receipts will be sent to this address."
    )
    amount: DonationAmount
    currency: DonationCurrency
    setup_future_usage: Literal["on_session"] | None = Field(
        None, description="If the payment method should be saved for future usage."
    )
    on_behalf_of_organization_id: UUID4 | None = Field(
        None,
        description="The organization to give credit to. The pledge will be paid by the authenticated user.",
    )
    message: str | None = Field(None, description="Message included with the donation")
    issue_id: UUID4 | None = Field(None)


class DonationUpdateStripePaymentIntent(Schema):
    email: str = Field(
        description="The donators email address. Receipts will be sent to this address."
    )
    amount: DonationAmount
    currency: DonationCurrency
    setup_future_usage: Literal["on_session"] | None = Field(
        None, description="If the payment method should be saved for future usage."
    )
    on_behalf_of_organization_id: UUID4 | None = Field(
        None,
        description="The organization to give credit to. The pledge will be paid by the authenticated user.",
    )
    message: str | None = Field(None, description="Message included with the donation")
    issue_id: UUID4 | None = Field(None)


class DonationStripePaymentIntentMutationResponse(Schema):
    payment_intent_id: str
    amount: int
    currency: str
    client_secret: str | None = None


class DonationCreateFromPaymentIntent(Schema):
    payment_intent_id: str


class DonationStatisticsPeriod(Schema):
    start_date: datetime.date
    end_date: datetime.date
    sum: int


class DonationStatistics(Schema):
    periods: Sequence[DonationStatisticsPeriod]


class PublicDonation(Schema):
    id: UUID4
    amount: int
    currency: str
    message: str | None
    donor: DonationOrganization | DonationUser | None
