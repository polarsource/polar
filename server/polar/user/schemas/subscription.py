from datetime import datetime

from pydantic import UUID4, Field

from polar.kit.schemas import EmailStrDNS, Schema
from polar.models.subscription import SubscriptionStatus
from polar.organization.schemas import Organization
from polar.product.schemas import Product, ProductPrice
from polar.subscription.schemas import SubscriptionBase


class UserSubscriptionBase(SubscriptionBase):
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime | None
    cancel_at_period_end: bool
    started_at: datetime | None
    ended_at: datetime | None

    user_id: UUID4
    product_id: UUID4
    price_id: UUID4


class UserSubscriptionProduct(Product):
    organization: Organization


class UserSubscription(UserSubscriptionBase):
    product: UserSubscriptionProduct
    price: ProductPrice


class UserFreeSubscriptionCreate(Schema):
    product_id: UUID4 = Field(
        ...,
        description="ID of the free tier to subscribe to.",
    )
    customer_email: EmailStrDNS | None = Field(
        None,
        description=(
            "Email of the customer. "
            "This field is required if the API is called outside the Polar app."
        ),
    )


class UserSubscriptionUpdate(Schema):
    product_price_id: UUID4
