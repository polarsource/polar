import uuid
from datetime import date, datetime
from typing import Literal, Self

import stripe as stripe_lib
from pydantic import (
    UUID4,
    AnyHttpUrl,
    Field,
    model_validator,
)

from polar.benefit.schemas import BenefitPublic, BenefitSubscriber
from polar.enums import Platforms
from polar.kit.schemas import EmailStrDNS, EmptyStrToNone, Schema, TimestampedSchema
from polar.models.subscription import SubscriptionStatus
from polar.models.subscription_tier import SubscriptionTier as SubscriptionTierModel
from polar.models.subscription_tier import SubscriptionTierType
from polar.models.subscription_tier_price import (
    SubscriptionTierPrice as SubscriptionTierPriceModel,
)
from polar.models.subscription_tier_price import SubscriptionTierPriceRecurringInterval

TIER_NAME_MIN_LENGTH = 3
TIER_NAME_MAX_LENGTH = 24
TIER_DESCRIPTION_MAX_LENGTH = 240

# SubscriptionTier

# Ref: https://stripe.com/docs/api/payment_intents/object#payment_intent_object-amount
MAXIMUM_PRICE_AMOUNT = 99999999


class SubscriptionTierPriceCreate(Schema):
    recurring_interval: SubscriptionTierPriceRecurringInterval
    price_amount: int = Field(..., gt=0, le=MAXIMUM_PRICE_AMOUNT)
    price_currency: str = Field("usd", pattern="usd")


class SubscriptionTierCreate(Schema):
    type: Literal[
        SubscriptionTierType.individual,
        SubscriptionTierType.business,
    ]
    name: str = Field(
        ..., min_length=TIER_NAME_MIN_LENGTH, max_length=TIER_NAME_MAX_LENGTH
    )
    description: EmptyStrToNone = Field(
        default=None, max_length=TIER_DESCRIPTION_MAX_LENGTH
    )
    is_highlighted: bool = False
    prices: list[SubscriptionTierPriceCreate] = Field(..., min_length=1)
    organization_id: UUID4 | None = None
    repository_id: UUID4 | None = None

    @model_validator(mode="after")
    def check_either_organization_or_repository(self) -> Self:
        if self.organization_id is not None and self.repository_id is not None:
            raise ValueError(
                "Subscription tiers should either be linked to "
                "an Organization or a Repository, not both."
            )
        if self.organization_id is None and self.repository_id is None:
            raise ValueError(
                "Subscription tiers should be linked to "
                "an Organization or a Repository."
            )
        return self


class ExistingSubscriptionTierPrice(Schema):
    id: UUID4


class SubscriptionTierUpdate(Schema):
    name: str | None = Field(
        default=None, min_length=TIER_NAME_MIN_LENGTH, max_length=TIER_NAME_MAX_LENGTH
    )
    description: EmptyStrToNone = Field(
        default=None, max_length=TIER_DESCRIPTION_MAX_LENGTH
    )
    is_highlighted: bool | None = None
    prices: list[ExistingSubscriptionTierPrice | SubscriptionTierPriceCreate] | None = (
        Field(default=None)
    )


class SubscriptionTierBenefitsUpdate(Schema):
    benefits: list[UUID4]


class SubscriptionTierPrice(TimestampedSchema):
    id: UUID4
    recurring_interval: SubscriptionTierPriceRecurringInterval
    price_amount: int
    price_currency: str
    is_archived: bool


class SubscriptionTierBase(TimestampedSchema):
    id: UUID4
    type: SubscriptionTierType
    name: str
    description: str | None = None
    is_highlighted: bool
    is_archived: bool
    organization_id: UUID4 | None = None
    repository_id: UUID4 | None = None
    prices: list[SubscriptionTierPrice]


class SubscriptionTier(SubscriptionTierBase):
    benefits: list[BenefitPublic] = Field(title="BenefitPublic")


class SubscriptionTierSubscriber(SubscriptionTierBase):
    benefits: list[BenefitSubscriber] = Field(title="BenefitSubscriber")


# SubscribeSession


class SubscribeSessionCreate(Schema):
    tier_id: UUID4 = Field(
        ...,
        description="ID of the Subscription Tier to subscribe to.",
    )
    price_id: UUID4 = Field(
        ...,
        description="ID of the Subscription Tier Price to subscribe to.",
    )
    success_url: AnyHttpUrl = Field(
        ...,
        description=(
            "URL where the backer will be redirected after a successful subscription. "
            "You can add the `session_id={CHECKOUT_SESSION_ID}` query parameter "
            "to retrieve the subscribe session id."
        ),
    )
    organization_subscriber_id: UUID4 | None = Field(
        None,
        description=(
            "ID of the Organization on behalf which you want to subscribe this tier to. "
            "You need to be an administrator of the Organization to do this."
        ),
    )
    customer_email: EmailStrDNS | None = Field(
        None,
        description=(
            "If you already know the email of your backer, you can set it. "
            "It'll be pre-filled on the subscription page."
        ),
    )


class SubscribeSession(Schema):
    id: str = Field(
        ...,
        description=("ID of the subscribe session."),
    )
    url: str | None = Field(
        None,
        description=(
            "URL where you should redirect your backer "
            "so they can subscribe to the selected tier."
        ),
    )
    customer_email: str | None = None
    customer_name: str | None = None
    organization_subscriber_id: UUID4 | None = None
    subscription_tier: SubscriptionTier
    price: SubscriptionTierPrice
    organization_name: str | None = None
    repository_name: str | None = None

    @classmethod
    def from_db(
        cls,
        checkout_session: stripe_lib.checkout.Session,
        subscription_tier: SubscriptionTierModel,
        price: SubscriptionTierPriceModel,
    ) -> Self:
        organization_subscriber_id: uuid.UUID | None = None
        if checkout_session.metadata:
            try:
                organization_subscriber_id = uuid.UUID(
                    checkout_session.metadata["organization_subscriber_id"]
                )
            except (KeyError, ValueError):
                pass

        return cls(
            id=checkout_session.id,
            url=checkout_session.url,
            customer_email=checkout_session.customer_details["email"]
            if checkout_session.customer_details
            else checkout_session.customer_email,
            customer_name=checkout_session.customer_details["name"]
            if checkout_session.customer_details
            else None,
            organization_subscriber_id=organization_subscriber_id,
            subscription_tier=subscription_tier,  # type: ignore
            price=price,  # type: ignore
            organization_name=subscription_tier.organization.name
            if subscription_tier.organization is not None
            else None,
            repository_name=subscription_tier.repository.name
            if subscription_tier.repository is not None
            else None,
        )


# Subscriptions


class SubscriptionPublicUser(Schema):
    public_name: str
    github_username: str | None = None
    avatar_url: str | None = None


class SubscriptionUser(SubscriptionPublicUser):
    email: str


class SubscriptionOrganization(Schema):
    name: str
    platform: Platforms
    avatar_url: str


class SubscriptionBase(TimestampedSchema):
    id: UUID4
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime | None = None
    cancel_at_period_end: bool
    started_at: datetime | None = None
    ended_at: datetime | None = None

    user_id: UUID4
    organization_id: UUID4 | None = None
    subscription_tier_id: UUID4
    price_id: UUID4 | None = None


class Subscription(SubscriptionBase):
    user: SubscriptionUser
    organization: SubscriptionOrganization | None = None
    subscription_tier: SubscriptionTier
    price: SubscriptionTierPrice | None = None


class SubscriptionSubscriber(SubscriptionBase):
    subscription_tier: SubscriptionTierSubscriber
    organization: SubscriptionOrganization | None = None
    price: SubscriptionTierPrice | None = None


class FreeSubscriptionCreate(Schema):
    tier_id: UUID4 = Field(
        ...,
        description="ID of the free Subscription Tier to subscribe to.",
    )
    customer_email: EmailStrDNS | None = Field(
        None,
        description=(
            "Email of your backer. "
            "This field is required if the API is called outside the Polar app."
        ),
    )


class SubscriptionUpgrade(Schema):
    subscription_tier_id: UUID4
    price_id: UUID4


class SubscriptionCreateEmail(Schema):
    email: EmailStrDNS


class SubscriptionsImported(Schema):
    count: int


class SubscriptionSummary(Schema):
    user: SubscriptionPublicUser
    organization: SubscriptionOrganization | None = None
    subscription_tier: SubscriptionTier
    price: SubscriptionTierPrice | None = None


class SubscriptionsStatisticsPeriod(Schema):
    start_date: date
    end_date: date
    subscribers: int
    earnings: int


class SubscriptionsStatistics(Schema):
    periods: list[SubscriptionsStatisticsPeriod]
