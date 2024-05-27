from collections.abc import Sequence
from datetime import date

from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema
from polar.product.schemas import ProductBase, ProductPrice
from polar.subscription.schemas import SubscriptionBase


class OrderBase(TimestampedSchema):
    id: UUID4
    amount: int
    tax_amount: int
    currency: str

    user_id: UUID4
    product_id: UUID4
    product_price_id: UUID4
    subscription_id: UUID4 | None = None


class OrderUser(Schema):
    id: UUID4
    email: str
    public_name: str
    github_username: str | None = None
    avatar_url: str | None = None


class OrderProduct(ProductBase): ...


class OrderSubscription(SubscriptionBase): ...


class Order(OrderBase):
    user: OrderUser
    product: OrderProduct
    product_price: ProductPrice
    subscription: OrderSubscription | None = None


class OrdersStatisticsPeriod(Schema):
    date: date
    orders: int
    earnings: int
    expected_orders: int
    expected_earnings: int


class OrdersStatistics(Schema):
    periods: Sequence[OrdersStatisticsPeriod]


class OrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")
