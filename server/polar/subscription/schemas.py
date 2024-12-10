from datetime import datetime
from typing import Annotated

from babel.numbers import format_currency
from pydantic import UUID4, AliasPath, Field

from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.discount.schemas import DiscountMinimal
from polar.enums import SubscriptionRecurringInterval
from polar.kit.address import Address
from polar.kit.metadata import MetadataOutputMixin
from polar.kit.schemas import (
    EmailStrDNS,
    IDSchema,
    MergeJSONSchema,
    Schema,
    TimestampedSchema,
)
from polar.kit.tax import TaxID
from polar.models.subscription import SubscriptionStatus
from polar.product.schemas import Product, ProductPriceRecurring


class SubscriptionCustomer(IDSchema, TimestampedSchema, MetadataOutputMixin):
    email: str
    email_verified: bool
    name: str | None
    billing_address: Address | None
    tax_id: TaxID | None
    organization_id: UUID4


class SubscriptionUser(Schema):
    id: UUID4 = Field(validation_alias="legacy_user_id")
    email: str
    public_name: str = Field(validation_alias="legacy_user_public_name")


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
        validation_alias=AliasPath("customer", "legacy_user_id"),
        deprecated="Use `customer_id`.",
    )
    user: SubscriptionUser = Field(
        validation_alias="customer", deprecated="Use `customer`."
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
