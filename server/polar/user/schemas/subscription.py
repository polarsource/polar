from datetime import datetime

from pydantic import UUID4

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.subscription import SubscriptionStatus
from polar.product.schemas import ProductPrice, ProductSubscriber


class UserSubscriptionBase(TimestampedSchema):
    id: UUID4
    status: SubscriptionStatus
    current_period_start: datetime
    current_period_end: datetime | None = None
    cancel_at_period_end: bool
    started_at: datetime | None = None
    ended_at: datetime | None = None

    user_id: UUID4
    organization_id: UUID4 | None = None
    product_id: UUID4
    price_id: UUID4 | None = None


class UserSubscriptionProduct(ProductSubscriber): ...


class UserSubscription(UserSubscriptionBase):
    product: UserSubscriptionProduct
    price: ProductPrice | None = None


class UserSubscriptionUpdate(Schema):
    product_price_id: UUID4
