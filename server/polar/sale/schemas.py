from collections.abc import Sequence
from datetime import date

from pydantic import UUID4

from polar.kit.schemas import Schema, TimestampedSchema
from polar.product.schemas import ProductBase, ProductPrice
from polar.subscription.schemas import SubscriptionBase


class SaleBase(TimestampedSchema):
    id: UUID4
    amount: int
    tax_amount: int
    currency: str

    user_id: UUID4
    product_id: UUID4
    product_price_id: UUID4
    subscription_id: UUID4 | None = None


class SaleUser(Schema):
    id: UUID4
    email: str
    public_name: str
    github_username: str | None = None
    avatar_url: str | None = None


class SaleProduct(ProductBase): ...


class SaleProductPrice(ProductPrice): ...


class SaleSubscription(SubscriptionBase): ...


class Sale(SaleBase):
    user: SaleUser
    product: SaleProduct
    product_price: SaleProductPrice
    subscription: SaleSubscription | None = None


class SalesStatisticsPeriod(Schema):
    date: date
    sales: int
    earnings: int
    expected_sales: int
    expected_earnings: int


class SalesStatistics(Schema):
    periods: Sequence[SalesStatisticsPeriod]
