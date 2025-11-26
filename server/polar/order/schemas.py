from typing import Annotated

from babel.numbers import format_currency
from fastapi import Path
from pydantic import (
    UUID4,
    AliasChoices,
    AliasPath,
    Field,
    computed_field,
    field_serializer,
)
from pydantic.json_schema import SkipJsonSchema

from polar.custom_field.data import CustomFieldDataOutputMixin
from polar.customer.schemas.customer import CustomerBase
from polar.discount.schemas import DiscountMinimal
from polar.exceptions import ResourceNotFound
from polar.kit.address import Address, AddressInput
from polar.kit.metadata import MetadataOutputMixin
from polar.kit.schemas import IDSchema, MergeJSONSchema, Schema, TimestampedSchema
from polar.models.order import (
    OrderBillingReason,
    OrderBillingReasonInternal,
    OrderStatus,
)
from polar.product.schemas import ProductBase, ProductPrice
from polar.subscription.schemas import SubscriptionBase

OrderID = Annotated[UUID4, Path(description="The order ID.")]

OrderNotFound = {
    "description": "Order not found.",
    "model": ResourceNotFound.schema(),
}


class OrderBase(TimestampedSchema, IDSchema):
    status: OrderStatus = Field(examples=["paid"])
    paid: bool = Field(
        description="Whether the order has been paid for.", examples=[True]
    )
    subtotal_amount: int = Field(
        description="Amount in cents, before discounts and taxes.", examples=[10000]
    )
    discount_amount: int = Field(
        description="Discount amount in cents.", examples=[1000]
    )
    net_amount: int = Field(
        description="Amount in cents, after discounts but before taxes.",
        examples=[9000],
    )

    tax_amount: int = Field(description="Sales tax amount in cents.", examples=[720])
    total_amount: int = Field(
        description="Amount in cents, after discounts and taxes.", examples=[9720]
    )

    applied_balance_amount: int = Field(
        description=(
            "Customer's balance amount applied to this invoice. "
            "Can increase the total amount paid, if the customer has a negative balance, "
            " or decrease it, if the customer has a positive balance."
            "Amount in cents."
        ),
        examples=[0],
    )
    due_amount: int = Field(
        description="Amount in cents that is due for this order.", examples=[0]
    )
    refunded_amount: int = Field(description="Amount refunded in cents.", examples=[0])
    refunded_tax_amount: int = Field(
        description="Sales tax refunded in cents.", examples=[0]
    )
    currency: str = Field(examples=["usd"])
    billing_reason: OrderBillingReasonInternal
    billing_name: str | None = Field(
        description="The name of the customer that should appear on the invoice. "
    )
    billing_address: Address | None

    @field_serializer("billing_reason")
    def serialize_billing_reason(
        self, value: OrderBillingReasonInternal
    ) -> OrderBillingReason:
        if value == OrderBillingReasonInternal.subscription_cycle_after_trial:
            return OrderBillingReason.subscription_cycle
        return OrderBillingReason(value)

    invoice_number: str = Field(
        description="The invoice number associated with this order."
    )
    is_invoice_generated: bool = Field(
        description="Whether an invoice has been generated for this order."
    )

    seats: int | None = Field(
        None, description="Number of seats purchased (for seat-based one-time orders)."
    )

    customer_id: UUID4
    product_id: UUID4 | None
    product_price_id: SkipJsonSchema[UUID4 | None] = Field(
        deprecated="Use `items` instead.",
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "product_price_id",
            # Validate from ORM model
            "legacy_product_price_id",
        ),
    )
    discount_id: UUID4 | None
    subscription_id: UUID4 | None
    checkout_id: UUID4 | None

    @computed_field(
        description="Amount in cents, after discounts but before taxes.",
        deprecated=(
            "Use `net_amount`. "
            "It has the same value and meaning, but the name is more descriptive."
        ),
    )
    def amount(self) -> SkipJsonSchema[int]:
        return self.net_amount

    @computed_field(deprecated="Use `applied_balance_amount`.")
    def from_balance_amount(self) -> SkipJsonSchema[int]:
        return self.applied_balance_amount

    def get_amount_display(self) -> str:
        return format_currency(
            self.net_amount / 100, self.currency.upper(), locale="en_US"
        )

    def get_refunded_amount_display(self) -> str:
        return format_currency(
            self.refunded_amount / 100, self.currency.upper(), locale="en_US"
        )


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


class OrderProduct(ProductBase, MetadataOutputMixin): ...


OrderDiscount = Annotated[DiscountMinimal, MergeJSONSchema({"title": "OrderDiscount"})]


class OrderSubscription(SubscriptionBase, MetadataOutputMixin):
    user_id: SkipJsonSchema[UUID4] = Field(
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

    label: str = Field(
        description="Description of the line item charge.", examples=["Pro Plan"]
    )
    amount: int = Field(
        description="Amount in cents, before discounts and taxes.", examples=[10000]
    )
    tax_amount: int = Field(description="Sales tax amount in cents.", examples=[720])
    proration: bool = Field(
        description="Whether this charge is due to a proration.", examples=[False]
    )
    product_price_id: UUID4 | None = Field(description="Associated price ID, if any.")


class Order(CustomFieldDataOutputMixin, MetadataOutputMixin, OrderBase):
    platform_fee_amount: int = Field(
        description="Platform fee amount in cents.", examples=[500]
    )
    platform_fee_currency: str | None = Field(
        description="Currency of the platform fee.", examples=["usd"]
    )
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
    user: SkipJsonSchema[OrderUser] = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user",
            # Validate from ORM model
            "customer",
        ),
        deprecated="Use `customer`.",
    )
    product: OrderProduct | None
    product_price: SkipJsonSchema[ProductPrice | None] = Field(
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
    description: str = Field(
        description="A summary description of the order.", examples=["Pro Plan"]
    )


class OrderUpdateBase(Schema):
    billing_name: str | None = Field(
        description=(
            "The name of the customer that should appear on the invoice. "
            "Can't be updated after the invoice is generated."
        )
    )
    billing_address: AddressInput | None = Field(
        description=(
            "The address of the customer that should appear on the invoice. "
            "Can't be updated after the invoice is generated."
        )
    )


class OrderUpdate(OrderUpdateBase):
    """Schema to update an order."""


class OrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")
