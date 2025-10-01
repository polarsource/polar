from datetime import datetime
from typing import Literal

from pydantic import UUID4, AliasChoices, Field
from pydantic.aliases import AliasPath
from pydantic.json_schema import SkipJsonSchema

from polar.benefit.strategies import BenefitGrantProperties
from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.enums import SubscriptionRecurringInterval
from polar.kit.metadata import (
    MetadataOutputMixin,
    MetadataOutputType,
)
from polar.kit.schemas import (
    BENEFIT_GRANT_ID_EXAMPLE,
    BENEFIT_ID_EXAMPLE,
    METER_ID_EXAMPLE,
    PRICE_ID_EXAMPLE,
    PRODUCT_ID_EXAMPLE,
    SUBSCRIPTION_ID_EXAMPLE,
    IDSchema,
    TimestampedSchema,
)
from polar.models.benefit import BenefitType
from polar.models.subscription import SubscriptionStatus
from polar.subscription.schemas import SubscriptionMeterBase

from .customer import CustomerBase


class CustomerStateSubscriptionMeter(SubscriptionMeterBase):
    """Current consumption and spending for a subscription meter."""


class CustomerStateSubscription(
    MetadataOutputMixin, CustomFieldDataOutputMixin, TimestampedSchema, IDSchema
):
    """An active customer subscription."""

    id: UUID4 = Field(
        description="The ID of the subscription.", examples=[SUBSCRIPTION_ID_EXAMPLE]
    )
    status: Literal[SubscriptionStatus.active, SubscriptionStatus.trialing] = Field(
        examples=["active", "trialing"]
    )
    amount: int = Field(description="The amount of the subscription.", examples=[1000])
    currency: str = Field(
        description="The currency of the subscription.", examples=["usd"]
    )
    recurring_interval: SubscriptionRecurringInterval = Field(
        description="The interval at which the subscription recurs."
    )
    current_period_start: datetime = Field(
        description="The start timestamp of the current billing period.",
        examples=["2025-02-03T13:37:00Z"],
    )
    current_period_end: datetime | None = Field(
        description="The end timestamp of the current billing period.",
        examples=["2025-03-03T13:37:00Z"],
    )
    trial_start: datetime | None = Field(
        description="The start timestamp of the trial period, if any.",
        examples=["2025-02-03T13:37:00Z"],
    )
    trial_end: datetime | None = Field(
        description="The end timestamp of the trial period, if any.",
        examples=["2025-03-03T13:37:00Z"],
    )
    cancel_at_period_end: bool = Field(
        description=(
            "Whether the subscription will be canceled "
            "at the end of the current period."
        ),
        examples=[False],
    )
    canceled_at: datetime | None = Field(
        description=(
            "The timestamp when the subscription was canceled. "
            "The subscription might still be active if `cancel_at_period_end` is `true`."
        ),
        examples=[None],
    )
    started_at: datetime | None = Field(
        description="The timestamp when the subscription started.",
        examples=["2025-01-03T13:37:00Z"],
    )
    ends_at: datetime | None = Field(
        description="The timestamp when the subscription will end.",
        examples=[None],
    )

    product_id: UUID4 = Field(
        description="The ID of the subscribed product.", examples=[PRODUCT_ID_EXAMPLE]
    )
    discount_id: UUID4 | None = Field(
        description="The ID of the applied discount, if any.", examples=[None]
    )

    price_id: SkipJsonSchema[UUID4] = Field(
        deprecated=True,
        examples=[PRICE_ID_EXAMPLE],
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "price_id",
            # Validate from ORM model
            AliasPath("prices", 0, "id"),
        ),
    )
    meters: list[CustomerStateSubscriptionMeter] = Field(
        description="List of meters associated with the subscription."
    )


class CustomerStateBenefitGrant(TimestampedSchema, IDSchema):
    """An active benefit grant for a customer."""

    id: UUID4 = Field(
        description="The ID of the grant.", examples=[BENEFIT_GRANT_ID_EXAMPLE]
    )
    granted_at: datetime = Field(
        description="The timestamp when the benefit was granted.",
        examples=["2025-01-03T13:37:00Z"],
    )
    benefit_id: UUID4 = Field(
        description="The ID of the benefit concerned by this grant.",
        examples=[BENEFIT_ID_EXAMPLE],
    )
    benefit_type: BenefitType = Field(
        description="The type of the benefit concerned by this grant.",
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "benefit_type",
            # Validate from ORM model
            AliasPath("benefit", "type"),
        ),
        examples=[BenefitType.custom],
    )
    benefit_metadata: MetadataOutputType = Field(
        description="The metadata of the benefit concerned by this grant.",
        examples=[{"key": "value"}],
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "benefit_metadata",
            # Validate from ORM model
            AliasPath("benefit", "user_metadata"),
        ),
    )
    properties: BenefitGrantProperties


class CustomerStateMeter(TimestampedSchema, IDSchema):
    """An active meter for a customer, with latest consumed and credited units."""

    meter_id: UUID4 = Field(
        description="The ID of the meter.", examples=[METER_ID_EXAMPLE]
    )
    consumed_units: float = Field(
        description="The number of consumed units.", examples=[25.0]
    )
    credited_units: int = Field(
        description="The number of credited units.", examples=[100]
    )
    balance: float = Field(
        description=(
            "The balance of the meter, "
            "i.e. the difference between credited and consumed units."
        ),
        examples=[75.0],
    )


class CustomerState(CustomerBase):
    """
    A customer along with additional state information:

    * Active subscriptions
    * Granted benefits
    * Active meters
    """

    active_subscriptions: list[CustomerStateSubscription] = Field(
        description="The customer's active subscriptions."
    )
    granted_benefits: list[CustomerStateBenefitGrant] = Field(
        description="The customer's active benefit grants."
    )
    active_meters: list[CustomerStateMeter] = Field(
        description="The customer's active meters.",
    )
