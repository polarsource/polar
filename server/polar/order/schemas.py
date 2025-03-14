from typing import Annotated

from babel.numbers import format_currency
from fastapi import Path
from pydantic import UUID4, AliasChoices, AliasPath, Field

from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.customer.schemas.customer import CustomerBase
from polar.discount.schemas import DiscountMinimal
from polar.exceptions import ResourceNotFound
from polar.kit.address import Address
from polar.kit.metadata import MetadataOutputMixin
from polar.kit.schemas import IDSchema, MergeJSONSchema, Schema, TimestampedSchema
from polar.models.order import OrderBillingReason
from polar.product.schemas import ProductBase, ProductPrice
from polar.subscription.schemas import SubscriptionBase

OrderID = Annotated[UUID4, Path(description="The order ID.")]

OrderNotFound = {
    "description": "Order not found.",
    "model": ResourceNotFound.schema(),
}


class OrderBase(
    CustomFieldDataOutputMixin, MetadataOutputMixin, IDSchema, TimestampedSchema
):
    status: str
    amount: int = Field(
        description="Amount in cents, before discounts and taxes.",
        deprecated=(
            "Use `subtotal_amount`. "
            "It has the same value and meaning, but the name is more descriptive."
        ),
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "amount",
            # Validate from ORM model
            "subtotal_amount",
        ),
    )
    subtotal_amount: int = Field(
        description="Amount in cents, before discounts and taxes."
    )
    discount_amount: int = Field(description="Discount amount in cents.")
    net_amount: int = Field(
        description="Amount in cents, after discounts but before taxes."
    )
    tax_amount: int = Field(description="Sales tax amount in cents.")
    total_amount: int = Field(description="Amount in cents, after discounts and taxes.")
    refunded_amount: int = Field(description="Amount refunded in cents.")
    refunded_tax_amount: int = Field(description="Sales tax refunded in cents.")
    currency: str
    billing_reason: OrderBillingReason
    billing_address: Address | None

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
    discount_id: UUID4 | None
    subscription_id: UUID4 | None
    checkout_id: UUID4 | None

    def get_amount_display(self) -> str:
        return f"{
            format_currency(
                self.amount / 100,
                self.currency.upper(),
                locale='en_US',
            )
        }"

    def get_refunded_amount_display(self) -> str:
        return f"{
            format_currency(
                self.refunded_amount / 100,
                self.currency.upper(),
                locale='en_US',
            )
        }"


class OrderCustomer(CustomerBase): ...


class OrderUser(Schema):
    id: UUID4 = Field(
        validation_alias=AliasChoices(
            # Validate from ORM model
            "legacy_user_id",
            # Validate from stored webhook payload
            "id",
        )
    )
    email: str
    public_name: str = Field(
        validation_alias=AliasChoices(
            # Validate from ORM model
            "legacy_user_public_name",
            # Validate from stored webhook payload
            "public_name",
        )
    )
    avatar_url: str | None = Field(None)
    github_username: str | None = Field(None)


class OrderProduct(ProductBase): ...


OrderDiscount = Annotated[DiscountMinimal, MergeJSONSchema({"title": "OrderDiscount"})]


class OrderSubscription(SubscriptionBase, MetadataOutputMixin):
    user_id: UUID4 = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user_id",
            # Validate from ORM model
            AliasPath("customer", "legacy_user_id"),
        ),
        deprecated="Use `customer_id`.",
    )


class OrderItemSchema(IDSchema, TimestampedSchema):
    """
    An order line item.
    """

    label: str = Field(description="Description of the line item charge.")
    amount: int = Field(description="Amount in cents, before discounts and taxes.")
    tax_amount: int = Field(description="Sales tax amount in cents.")
    proration: bool = Field(description="Whether this charge is due to a proration.")
    product_price_id: UUID4 | None = Field(description="Associated price ID, if any.")


class Order(OrderBase):
    customer: OrderCustomer
    user_id: UUID4 = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user_id",
            # Validate from ORM model
            AliasPath("customer", "legacy_user_id"),
        ),
        deprecated="Use `customer_id`.",
    )
    user: OrderUser = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user",
            # Validate from ORM model
            "customer",
        ),
        deprecated="Use `customer`.",
    )
    product: OrderProduct
    product_price: ProductPrice = Field(
        deprecated="Use `items` instead.",
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "product_price",
            # Validate from ORM model
            "legacy_product_price",
        ),
    )
    discount: OrderDiscount | None
    subscription: OrderSubscription | None
    items: list[OrderItemSchema] = Field(description="Line items composing the order.")


class OrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")
