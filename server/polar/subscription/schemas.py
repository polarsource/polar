from collections.abc import Iterable
from typing import Any, Self

import stripe as stripe_lib
from pydantic import UUID4, AnyHttpUrl, EmailStr, Field, root_validator, validator

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.subscription_benefit import (
    SubscriptionBenefitType,
    TaxApplicationMustBeSpecified,
)
from polar.models.subscription_tier import SubscriptionTier as SubscriptionTierModel
from polar.models.subscription_tier import SubscriptionTierType

TIER_NAME_MIN_LENGTH = 3
TIER_NAME_MAX_LENGTH = 24
TIER_DESCRIPTION_MAX_LENGTH = 240
BENEFIT_DESCRIPTION_MAX_LENGTH = 120


class SubscriptionBenefitCreate(Schema):
    type: SubscriptionBenefitType
    description: str = Field(..., max_length=BENEFIT_DESCRIPTION_MAX_LENGTH)
    is_tax_applicable: bool | None = None
    organization_id: UUID4 | None = None
    repository_id: UUID4 | None = None

    @root_validator
    def check_either_organization_or_repository(
        cls, values: dict[str, Any]
    ) -> dict[str, Any]:
        organization_id = values.get("organization_id")
        repository_id = values.get("repository_id")
        if organization_id is not None and repository_id is not None:
            raise ValueError(
                "Subscription benefits should either be linked to "
                "an Organization or a Repository, not both."
            )
        if organization_id is None and repository_id is None:
            raise ValueError(
                "Subscription benefits should be linked to "
                "an Organization or a Repository."
            )
        return values

    @root_validator
    def check_is_tax_applicable(cls, values: dict[str, Any]) -> dict[str, Any]:
        benefit_type: SubscriptionBenefitType = values["type"]
        try:
            values["is_tax_applicable"] = benefit_type.is_tax_applicable()
        except TaxApplicationMustBeSpecified as e:
            if values.get("is_tax_applicable") is None:
                raise ValueError(e.message) from e
        return values


class SubscriptionBenefitUpdate(Schema):
    description: str | None = Field(None, max_length=BENEFIT_DESCRIPTION_MAX_LENGTH)


class SubscriptionBenefit(TimestampedSchema):
    id: UUID4
    type: SubscriptionBenefitType
    description: str
    organization_id: UUID4 | None = None
    repository_id: UUID4 | None = None


class SubscriptionTierCreate(Schema):
    type: SubscriptionTierType
    name: str = Field(
        ..., min_length=TIER_NAME_MIN_LENGTH, max_length=TIER_NAME_MAX_LENGTH
    )
    description: str | None = Field(None, max_length=TIER_DESCRIPTION_MAX_LENGTH)
    is_highlighted: bool = False
    price_amount: int = Field(..., ge=0)
    price_currency: str = Field("USD", regex="USD")
    organization_id: UUID4 | None = None
    repository_id: UUID4 | None = None

    @root_validator
    def check_either_organization_or_repository(
        cls, values: dict[str, Any]
    ) -> dict[str, Any]:
        organization_id = values.get("organization_id")
        repository_id = values.get("repository_id")
        if organization_id is not None and repository_id is not None:
            raise ValueError(
                "Subscription tiers should either be linked to "
                "an Organization or a Repository, not both."
            )
        if organization_id is None and repository_id is None:
            raise ValueError(
                "Subscription tiers should be linked to "
                "an Organization or a Repository."
            )
        return values


class SubscriptionTierUpdate(Schema):
    name: str | None = Field(
        None, min_length=TIER_NAME_MIN_LENGTH, max_length=TIER_NAME_MAX_LENGTH
    )
    description: str | None = Field(None, max_length=TIER_DESCRIPTION_MAX_LENGTH)
    is_highlighted: bool | None = None
    price_amount: int | None = Field(None, ge=0)
    price_currency: str | None = Field(None, regex="USD")


class SubscriptionTierBenefitsUpdate(Schema):
    benefits: list[UUID4]


class SubscriptionTier(TimestampedSchema):
    id: UUID4
    type: SubscriptionTierType
    name: str
    description: str | None = None
    is_highlighted: bool
    price_amount: int
    price_currency: str
    is_archived: bool
    organization_id: UUID4 | None = None
    repository_id: UUID4 | None = None
    benefits: list[SubscriptionBenefit]

    @validator("benefits", pre=True)
    def benefits_association_proxy_fix(
        cls, v: Iterable[SubscriptionBenefit]
    ) -> list[SubscriptionBenefit]:
        # FIXME: Not needed in Pydantic V2
        return list(v)


class SubscribeSessionCreate(Schema):
    tier_id: UUID4 = Field(
        ...,
        description="ID of the Subscription Tier to subscribe to.",
    )
    success_url: AnyHttpUrl = Field(
        ...,
        description=(
            "URL where the backer will be redirected after a successful subscription. "
            "You can add the `session_id={CHECKOUT_SESSION_ID}` query parameter "
            "to retrieve the subscribe session id."
        ),
    )
    customer_email: EmailStr | None = Field(
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
    subscription_tier: SubscriptionTier
    organization_name: str | None = None
    repository_name: str | None = None

    @classmethod
    def from_db(
        cls,
        checkout_session: stripe_lib.checkout.Session,
        subscription_tier: SubscriptionTierModel,
    ) -> Self:
        return cls(
            id=checkout_session.stripe_id,
            url=checkout_session.url,
            customer_email=checkout_session.customer_details["email"]
            if checkout_session.customer_details
            else checkout_session.customer_email,
            customer_name=checkout_session.customer_details["name"]
            if checkout_session.customer_details
            else None,
            subscription_tier=subscription_tier,  # type: ignore
            organization_name=subscription_tier.organization.name
            if subscription_tier.organization is not None
            else None,
            repository_name=subscription_tier.repository.name
            if subscription_tier.repository is not None
            else None,
        )
