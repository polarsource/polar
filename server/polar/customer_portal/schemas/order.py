from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema
from polar.organization.schemas import Organization
from polar.product.schemas import (
    BenefitPublicList,
    ProductBase,
    ProductMediaList,
    ProductPrice,
    ProductPriceList,
)
from polar.subscription.schemas import SubscriptionBase


class CustomerOrderBase(TimestampedSchema):
    id: UUID4
    amount: int
    tax_amount: int
    currency: str

    customer_id: UUID4
    user_id: UUID4 = Field(
        validation_alias="customer_id", deprecated="Use `customer_id`."
    )
    product_id: UUID4
    product_price_id: UUID4
    subscription_id: UUID4 | None


class CustomerOrderProduct(ProductBase):
    prices: ProductPriceList
    benefits: BenefitPublicList
    medias: ProductMediaList
    organization: Organization


class CustomerOrderSubscription(SubscriptionBase): ...


class CustomerOrder(CustomerOrderBase):
    product: CustomerOrderProduct
    product_price: ProductPrice
    subscription: CustomerOrderSubscription | None


class CustomerOrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")
