from typing import Annotated

from babel.numbers import format_currency
from pydantic import UUID4, Field

from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.discount.schemas import DiscountMinimal
from polar.kit.address import Address
from polar.kit.metadata import MetadataOutputMixin
from polar.kit.schemas import IDSchema, MergeJSONSchema, Schema, TimestampedSchema
from polar.kit.tax import TaxID
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

    user_id: UUID4 = Field(
        validation_alias="customer_id", deprecated="Use `customer_id`."
    )
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


class OrderCustomer(IDSchema, TimestampedSchema, MetadataOutputMixin):
    email: str
    email_verified: bool
    name: str | None
    billing_address: Address | None
    tax_id: TaxID | None
    organization_id: UUID4


class OrderProduct(ProductBase): ...


OrderDiscount = Annotated[DiscountMinimal, MergeJSONSchema({"title": "OrderDiscount"})]


class OrderSubscription(SubscriptionBase, MetadataOutputMixin): ...


class Order(OrderBase):
    customer: OrderCustomer
    user: OrderCustomer = Field(
        validation_alias="customer", deprecated="Use `customer`."
    )
    product: OrderProduct
    product_price: ProductPrice
    discount: OrderDiscount | None
    subscription: OrderSubscription | None


class OrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")
