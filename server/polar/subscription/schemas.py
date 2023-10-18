from typing import Any

from pydantic import UUID4, AnyHttpUrl, EmailStr, Field, root_validator

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.subscription_tier import SubscriptionTierType

NAME_MIN_LENGTH = 3
NAME_MAX_LENGTH = 24
DESCRIPTION_MAX_LENGTH = 240


class SubscriptionTierCreate(Schema):
    type: SubscriptionTierType
    name: str = Field(..., min_length=NAME_MIN_LENGTH, max_length=NAME_MAX_LENGTH)
    description: str | None = Field(None, max_length=DESCRIPTION_MAX_LENGTH)
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
        None, min_length=NAME_MIN_LENGTH, max_length=NAME_MAX_LENGTH
    )
    description: str | None = Field(None, max_length=DESCRIPTION_MAX_LENGTH)
    is_highlighted: bool | None = None
    price_amount: int | None = Field(None, ge=0)
    price_currency: str | None = Field(None, regex="USD")


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
