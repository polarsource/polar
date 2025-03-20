from pydantic import UUID4, AliasChoices, AliasPath, Field

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.order import OrderStatus
from polar.order.schemas import OrderItemSchema
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
    status: OrderStatus = Field(examples=["paid"])
    paid: bool = Field(
        description="Whether the order has been paid for.", examples=[True]
    )
    subtotal_amount: int = Field(
        description="Amount in cents, before discounts and taxes."
    )
    discount_amount: int = Field(description="Discount amount in cents.")
    net_amount: int = Field(
        description="Amount in cents, after discounts but before taxes."
    )
    amount: int = Field(
        description="Amount in cents, after discounts but before taxes.",
        deprecated=(
            "Use `net_amount`. "
            "It has the same value and meaning, but the name is more descriptive."
        ),
        validation_alias="net_amount",
    )
    tax_amount: int = Field(description="Sales tax amount in cents.")
    total_amount: int = Field(description="Amount in cents, after discounts and taxes.")
    refunded_amount: int = Field(description="Amount refunded in cents.")
    refunded_tax_amount: int = Field(description="Sales tax refunded in cents.")
    currency: str

    customer_id: UUID4
    product_id: UUID4
    product_price_id: UUID4 = Field(
        deprecated="Use `items` instead.",
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "product_price_id",
            # Validate from ORM model
            AliasPath("legacy_product_price", "id"),
        ),
    )
    subscription_id: UUID4 | None


class CustomerOrderProduct(ProductBase):
    prices: ProductPriceList
    benefits: BenefitPublicList
    medias: ProductMediaList
    organization: Organization


class CustomerOrderSubscription(SubscriptionBase): ...


class CustomerOrder(CustomerOrderBase):
    user_id: UUID4 = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user_id",
            # Validate from ORM model
            AliasPath("customer", "legacy_user_id"),
        ),
        deprecated="Use `customer_id`.",
    )
    product: CustomerOrderProduct
    product_price: ProductPrice = Field(
        deprecated="Use `items` instead.",
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "product_price",
            # Validate from ORM model
            "legacy_product_price",
        ),
    )
    subscription: CustomerOrderSubscription | None
    items: list[OrderItemSchema] = Field(description="Line items composing the order.")


class CustomerOrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")
