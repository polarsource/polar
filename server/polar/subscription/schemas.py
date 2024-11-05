from datetime import datetime

from babel.numbers import format_currency
from pydantic import UUID4, Field

from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.enums import SubscriptionRecurringInterval
from polar.kit.metadata import MetadataOutputMixin
from polar.kit.schemas import EmailStrDNS, IDSchema, Schema, TimestampedSchema
from polar.models.subscription import SubscriptionStatus
from polar.product.schemas import Product, ProductPriceRecurring


class SubscriptionUser(Schema):
    email: str
    public_name: str
    github_username: str | None
    avatar_url: str | None


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

    user_id: UUID4
    product_id: UUID4
    price_id: UUID4
    checkout_id: UUID4 | None

    def get_amount_display(self) -> str:
        if self.amount is None or self.currency is None:
            return "Free"
        return f"{format_currency(
            self.amount / 100,
            self.currency.upper(),
            locale="en_US",
        )}/{self.recurring_interval}"


class Subscription(CustomFieldDataOutputMixin, MetadataOutputMixin, SubscriptionBase):
    user: SubscriptionUser
    product: Product
    price: ProductPriceRecurring


class SubscriptionCreateEmail(Schema):
    """Request schema for creating a subscription by email."""

    email: EmailStrDNS = Field(description="The email address of the user.")
    product_id: UUID4 = Field(
        description="The ID of the product. **Must be the free subscription tier**."
    )
