from typing import Annotated

from babel.numbers import format_currency
from pydantic import UUID4, AliasPath, Field

from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.customer.schemas import CustomerBase
from polar.discount.schemas import DiscountMinimal
from polar.kit.address import Address
from polar.kit.metadata import MetadataOutputMixin
from polar.kit.schemas import IDSchema, MergeJSONSchema, Schema, TimestampedSchema
from polar.models.order import OrderBillingReason
from polar.product.schemas import ProductBase, ProductPrice
from polar.subscription.schemas import SubscriptionBase


class OrderBase(
    CustomFieldDataOutputMixin, MetadataOutputMixin, IDSchema, TimestampedSchema
):
    amount: int
    tax_amount: int
    currency: str
    billing_reason: OrderBillingReason
    billing_address: Address | None

    customer_id: UUID4
    product_id: UUID4
    product_price_id: UUID4
    discount_id: UUID4 | None
    subscription_id: UUID4 | None
    checkout_id: UUID4 | None

    def get_amount_display(self) -> str:
        return f"{format_currency(
            self.amount / 100,
            self.currency.upper(),
            locale="en_US",
        )}"


class OrderCustomer(CustomerBase): ...


class OrderUser(Schema):
    id: UUID4 = Field(validation_alias="legacy_user_id")
    email: str
    public_name: str = Field(validation_alias="legacy_user_public_name")


class OrderProduct(ProductBase): ...


OrderDiscount = Annotated[DiscountMinimal, MergeJSONSchema({"title": "OrderDiscount"})]


class OrderSubscription(SubscriptionBase, MetadataOutputMixin): ...


class Order(OrderBase):
    customer: OrderCustomer
    user_id: UUID4 = Field(
        validation_alias=AliasPath("customer", "legacy_user_id"),
        deprecated="Use `customer_id`.",
    )
    user: OrderUser = Field(validation_alias="customer", deprecated="Use `customer`.")
    product: OrderProduct
    product_price: ProductPrice
    discount: OrderDiscount | None
    subscription: OrderSubscription | None


class OrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")
