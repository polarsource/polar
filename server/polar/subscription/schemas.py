import inspect
from datetime import datetime
from typing import Annotated, Literal

from babel.numbers import format_currency
from fastapi import Path
from pydantic import UUID4, AliasChoices, AliasPath, Field

from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.customer.schemas import CustomerBase
from polar.discount.schemas import DiscountMinimal
from polar.enums import SubscriptionProrationBehavior, SubscriptionRecurringInterval
from polar.kit.metadata import MetadataOutputMixin
from polar.kit.schemas import (
    EmailStrDNS,
    IDSchema,
    MergeJSONSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.models.subscription import CustomerCancellationReason, SubscriptionStatus
from polar.product.schemas import Product, ProductPriceRecurring

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
    amount: int | None
    currency: str | None
    recurring_interval: SubscriptionRecurringInterval
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime | None
    cancel_at_period_end: bool
    canceled_at: datetime | None
    started_at: datetime | None
    ends_at: datetime | None
    ended_at: datetime | None

    customer_id: UUID4
    product_id: UUID4
    price_id: UUID4
    discount_id: UUID4 | None
    checkout_id: UUID4 | None

    customer_cancellation_reason: CustomerCancellationReason | None
    customer_cancellation_comment: str | None

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


class Subscription(CustomFieldDataOutputMixin, MetadataOutputMixin, SubscriptionBase):
    customer: SubscriptionCustomer
    user_id: UUID4 = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user_id",
            # Validate from ORM model
            AliasPath("customer", "legacy_user_id"),
        ),
        deprecated="Use `customer_id`.",
    )
    user: SubscriptionUser = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user",
            # Validate from ORM model
            "customer",
        ),
        deprecated="Use `customer`.",
    )
    product: Product
    price: ProductPriceRecurring
    discount: SubscriptionDiscount | None


class SubscriptionCreateEmail(Schema):
    """Request schema for creating a subscription by email."""

    email: EmailStrDNS = Field(description="The email address of the user.")
    product_id: UUID4 = Field(
        description="The ID of the product. **Must be the free subscription tier**."
    )


class SubscriptionUpdatePrice(Schema):
    product_price_id: UUID4 = Field(description="Update subscription to another price.")
    proration_behavior: SubscriptionProrationBehavior | None = Field(
        default=None,
        description=(
            "Determine how to handle the proration billing. "
            "If not provided, will use the default organization setting."
        ),
    )


class SubscriptionCancel(Schema):
    cancel_at_period_end: bool | None = Field(
        None,
        description=inspect.cleandoc(
            """
        Cancel an active subscription once the current period ends.

        Or uncancel a subscription currently set to be revoked at period end.
        """
        ),
    )
    revoke: Literal[True] | None = Field(
        None,
        description="Cancel and revoke an active subscription immediately",
    )
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


SubscriptionUpdate = Annotated[
    SubscriptionUpdatePrice | SubscriptionCancel,
    SetSchemaReference("SubscriptionUpdate"),
]
