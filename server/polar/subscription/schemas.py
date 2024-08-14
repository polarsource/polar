from datetime import datetime

from pydantic import UUID4, Field

from polar.kit.schemas import EmailStrDNS, IDSchema, Schema, TimestampedSchema
from polar.models.subscription import SubscriptionStatus
from polar.product.schemas import Product, ProductPrice


class SubscriptionUser(Schema):
    email: str
    public_name: str
    github_username: str | None = None
    avatar_url: str | None = None


class SubscriptionBase(IDSchema, TimestampedSchema):
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime | None = None
    cancel_at_period_end: bool
    started_at: datetime | None = None
    ended_at: datetime | None = None

    user_id: UUID4
    product_id: UUID4
    price_id: UUID4 | None = None


class Subscription(SubscriptionBase):
    user: SubscriptionUser
    product: Product
    price: ProductPrice | None = None


class SubscriptionCreateEmail(Schema):
    """Request schema for creating a subscription by email."""

    email: EmailStrDNS = Field(description="The email address of the user.")
    product_id: UUID4 = Field(
        description="The ID of the product. **Must be the free subscription tier**."
    )


class SubscriptionsImported(Schema):
    """Result of a subscription import operation."""

    count: int
