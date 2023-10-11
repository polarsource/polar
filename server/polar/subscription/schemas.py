from typing import Any

from pydantic import UUID4, Field, root_validator

from polar.kit.schemas import Schema, TimestampedSchema


class SubscriptionTierCreate(Schema):
    name: str
    description: str | None = None
    price_amount: int = Field(..., ge=0)
    price_currency: str = Field("USD", regex="USD")
    subscription_group_id: UUID4


class SubscriptionTierUpdate(Schema):
    name: str | None = None
    description: str | None = None
    price_amount: int | None = Field(None, ge=0)
    price_currency: str | None = Field(None, regex="USD")


class SubscriptionTier(TimestampedSchema):
    id: UUID4
    name: str
    description: str | None = None
    price_amount: int
    price_currency: str
    is_archived: bool
    subscription_group_id: UUID4


class SubscriptionGroupCreate(Schema):
    name: str
    order: int
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
                "A SubscriptionGroup should either be linked to "
                "an Organization or a Repository, not both."
            )
        if organization_id is None and repository_id is None:
            raise ValueError(
                "A SubscriptionGroup should be linked to "
                "an Organization or a Repository."
            )
        return values


class SubscriptionGroupUpdate(Schema):
    name: str | None = None
    order: int | None = None


class SubscriptionGroup(TimestampedSchema):
    id: UUID4
    name: str
    order: int
    organization_id: UUID4 | None = None
    repository_id: UUID4 | None = None
    tiers: list[SubscriptionTier]
