from datetime import datetime
from typing import Annotated

from babel.numbers import format_currency
from pydantic import UUID4, AliasChoices, AliasPath, Field

from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.customer.schemas import CustomerBase
from polar.discount.schemas import DiscountMinimal
from polar.enums import SubscriptionRecurringInterval
from polar.kit.metadata import MetadataOutputMixin
from polar.kit.schemas import (
    EmailStrDNS,
    IDSchema,
    MergeJSONSchema,
    Schema,
    TimestampedSchema,
)
from polar.models.subscription import SubscriptionStatus
from polar.product.schemas import Product, ProductPriceRecurring


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


class SubscriptionBase(IDSchema, TimestampedSchema):
    amount: int | None
    currency: str | None
    recurring_interval: SubscriptionRecurringInterval
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime | None
    cancel_at_period_end: bool
    started_at: datetime | None
    ended_at: datetime | None

    customer_id: UUID4
    product_id: UUID4
    price_id: UUID4
    discount_id: UUID4 | None
    checkout_id: UUID4 | None

    def get_amount_display(self) -> str:
        if self.amount is None or self.currency is None:
            return "Free"
        return f"{format_currency(
            self.amount / 100,
            self.currency.upper(),
            locale="en_US",
        )}/{self.recurring_interval}"


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
