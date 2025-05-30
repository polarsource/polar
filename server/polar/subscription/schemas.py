import inspect
from datetime import datetime
from typing import Annotated, Literal

from babel.numbers import format_currency
from fastapi import Path
from pydantic import UUID4, AliasChoices, AliasPath, Field
from pydantic.json_schema import SkipJsonSchema

from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.customer.schemas.customer import CustomerBase
from polar.discount.schemas import DiscountMinimal
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.kit.email import EmailStrDNS
from polar.kit.metadata import MetadataOutputMixin
from polar.kit.schemas import (
    METER_ID_EXAMPLE,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.meter.schemas import Meter
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.product.schemas import Product, ProductPrice

SubscriptionID = Annotated[UUID4, Path(description="The subscription ID.")]


class SubscriptionCustomer(CustomerBase): ...


class SubscriptionUser(Schema):
    id: UUID4 = Field(
        validation_alias=AliasChoices(
            # Validate from ORM model
            "legacy_user_id",
            # Validate from stored webhook payload
            "id",
        )
    )
    email: str
    public_name: str = Field(
        validation_alias=AliasChoices(
            # Validate from ORM model
            "legacy_user_public_name",
            # Validate from stored webhook payload
            "public_name",
        )
    )
    avatar_url: str | None = Field(None)
    github_username: str | None = Field(None)


class SubscriptionBase(IDSchema, TimestampedSchema):
    amount: int = Field(description="The amount of the subscription.")
    currency: str = Field(description="The currency of the subscription.")
    recurring_interval: SubscriptionRecurringInterval = Field(
        description="The interval at which the subscription recurs."
    )
    status: SubscriptionStatus = Field(description="The status of the subscription.")
    current_period_start: datetime = Field(
        description="The start timestamp of the current billing period."
    )
    current_period_end: datetime | None = Field(
        description="The end timestamp of the current billing period."
    )
    cancel_at_period_end: bool = Field(
        description=(
            "Whether the subscription will be canceled "
            "at the end of the current period."
        )
    )
    canceled_at: datetime | None = Field(
        description=(
            "The timestamp when the subscription was canceled. "
            "The subscription might still be active if `cancel_at_period_end` is `true`."
        )
    )
    started_at: datetime | None = Field(
        description="The timestamp when the subscription started."
    )
    ends_at: datetime | None = Field(
        description="The timestamp when the subscription will end."
    )
    ended_at: datetime | None = Field(
        description="The timestamp when the subscription ended."
    )

    customer_id: UUID4 = Field(description="The ID of the subscribed customer.")
    product_id: UUID4 = Field(description="The ID of the subscribed product.")
    discount_id: UUID4 | None = Field(
        description="The ID of the applied discount, if any."
    )
    checkout_id: UUID4 | None

    customer_cancellation_reason: CustomerCancellationReason | None
    customer_cancellation_comment: str | None

    price_id: SkipJsonSchema[UUID4] = Field(
        deprecated="Use `prices` instead.",
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "price_id",
            # Validate from ORM model
            AliasPath("prices", 0, "id"),
        ),
    )

    def get_amount_display(self) -> str:
        if self.amount is None or self.currency is None:
            return "Free"
        return f"{
            format_currency(
                self.amount / 100,
                self.currency.upper(),
                locale='en_US',
            )
        }/{self.recurring_interval}"


SubscriptionDiscount = Annotated[
    DiscountMinimal, MergeJSONSchema({"title": "SubscriptionDiscount"})
]


class SubscriptionMeterBase(IDSchema, TimestampedSchema):
    consumed_units: float = Field(
        description="The number of consumed units so far in this billing period.",
        examples=[25.0],
    )
    credited_units: int = Field(
        description="The number of credited units so far in this billing period.",
        examples=[100],
    )
    amount: int = Field(
        description="The amount due in cents so far in this billing period.",
        examples=[0],
    )
    meter_id: UUID4 = Field(
        description="The ID of the meter.", examples=[METER_ID_EXAMPLE]
    )


class SubscriptionMeter(SubscriptionMeterBase):
    """Current consumption and spending for a subscription meter."""

    meter: Meter = Field(
        description="The meter associated with this subscription.",
    )


class Subscription(CustomFieldDataOutputMixin, MetadataOutputMixin, SubscriptionBase):
    customer: SubscriptionCustomer
    user_id: SkipJsonSchema[UUID4] = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user_id",
            # Validate from ORM model
            AliasPath("customer", "legacy_user_id"),
        ),
        deprecated="Use `customer_id`.",
    )
    user: SkipJsonSchema[SubscriptionUser] = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user",
            # Validate from ORM model
            "customer",
        ),
        deprecated="Use `customer`.",
    )
    product: Product
    discount: SubscriptionDiscount | None

    price: SkipJsonSchema[ProductPrice] = Field(
        deprecated="Use `prices` instead.",
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "price",
            # Validate from ORM model
            AliasPath("prices", 0),
        ),
    )

    prices: list[ProductPrice] = Field(
        description="List of enabled prices for the subscription."
    )
    meters: list[SubscriptionMeter] = Field(
        description="List of meters associated with the subscription."
    )


class SubscriptionCreateEmail(Schema):
    """Request schema for creating a subscription by email."""

    email: EmailStrDNS = Field(description="The email address of the user.")
    product_id: UUID4 = Field(
        description="The ID of the product. **Must be the free subscription tier**."
    )


class SubscriptionUpdateProduct(Schema):
    product_id: UUID4 = Field(description="Update subscription to another product.")
    proration_behavior: SubscriptionProrationBehavior | None = Field(
        default=None,
        description=(
            "Determine how to handle the proration billing. "
            "If not provided, will use the default organization setting."
        ),
    )


class SubscriptionCancelBase(Schema):
    customer_cancellation_reason: CustomerCancellationReason | None = Field(
        None,
        description=inspect.cleandoc(
            """
        Customer reason for cancellation.

        Helpful to monitor reasons behind churn for future improvements.

        Only set this in case your own service is requesting the reason from the
        customer. Or you know based on direct conversations, i.e support, with
        the customer.

        * `too_expensive`: Too expensive for the customer.
        * `missing_features`: Customer is missing certain features.
        * `switched_service`: Customer switched to another service.
        * `unused`: Customer is not using it enough.
        * `customer_service`: Customer is not satisfied with the customer service.
        * `low_quality`: Customer is unhappy with the quality.
        * `too_complex`: Customer considers the service too complicated.
        * `other`: Other reason(s).
        """
        ),
    )
    customer_cancellation_comment: str | None = Field(
        None,
        description=inspect.cleandoc(
            """
            Customer feedback and why they decided to cancel.

            **IMPORTANT:**
            Do not use this to store internal notes! It's intended to be input
            from the customer and is therefore also available in their Polar
            purchases library.

            Only set this in case your own service is requesting the reason from the
            customer. Or you copy a message directly from a customer
            conversation, i.e support.
            """
        ),
    )


class SubscriptionCancel(SubscriptionCancelBase):
    cancel_at_period_end: bool = Field(
        description=inspect.cleandoc(
            """
        Cancel an active subscription once the current period ends.

        Or uncancel a subscription currently set to be revoked at period end.
        """
        ),
    )


class SubscriptionRevoke(SubscriptionCancelBase):
    revoke: Literal[True] = Field(
        description="Cancel and revoke an active subscription immediately"
    )


SubscriptionUpdate = Annotated[
    SubscriptionUpdateProduct | SubscriptionCancel | SubscriptionRevoke,
    SetSchemaReference("SubscriptionUpdate"),
]
