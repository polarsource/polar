from datetime import date, datetime

from pydantic import UUID4

from polar.kit.schemas import EmailStrDNS, Schema, TimestampedSchema
from polar.models.subscription import SubscriptionStatus
from polar.product.schemas import Product, ProductPrice


class SubscriptionUser(Schema):
    email: str
    public_name: str
    github_username: str | None = None
    avatar_url: str | None = None


class SubscriptionBase(TimestampedSchema):
    id: UUID4
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
    email: EmailStrDNS


class SubscriptionsImported(Schema):
    count: int


class SubscriptionsStatisticsPeriod(Schema):
    start_date: date
    end_date: date
    subscribers: int
    earnings: int


class SubscriptionsStatistics(Schema):
    periods: list[SubscriptionsStatisticsPeriod]
