from typing import Annotated

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

from polar.custom_field.data import (
    CustomFieldDataInputMixin,
    CustomFieldDataOutputMixin,
)
from polar.customer.schemas.customer import CustomerBase
from polar.discount.schemas import DiscountMinimal
from polar.exceptions import ResourceNotFound
from polar.kit.address import Address, AddressInput
from polar.kit.currency import format_currency
from polar.kit.metadata import MetadataInputMixin, MetadataOutputMixin
from polar.kit.schemas import IDSchema, MergeJSONSchema, Schema, TimestampedSchema
from polar.models.order import (
    OrderBillingReason,
    OrderBillingReasonInternal,
    OrderStatus,
)
from polar.organization.schemas import OrganizationID
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
        if value in (
            OrderBillingReasonInternal.subscription_cycle_after_trial,
            OrderBillingReasonInternal.subscription_cancel,
        ):
            return OrderBillingReason.subscription_cycle
        return OrderBillingReason(value)

    invoice_number: str | None = Field(
        description=(
            "The invoice number associated with this order. "
            "`null` while the order is in `draft` status; assigned at finalize."
        )
    )
    is_invoice_generated: bool = Field(
        description="Whether an invoice has been generated for this order."
    )

    receipt_number: str | None = Field(
        description=(
            "The receipt number for this order. "
            "Set once the order is paid for organizations with receipts enabled. "
            "When set, a downloadable receipt PDF can be obtained via the receipt endpoint."
        ),
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

    @computed_field(
        description=(
            "Amount in cents that can still be refunded (net, before taxes). "
            "Accounts for any applied customer balance and previous refunds."
        ),
        examples=[9000],
    )
    def refundable_amount(self) -> int:
        return max(
            0, self.net_amount + self.applied_balance_amount - self.refunded_amount
        )

    @computed_field(
        description=(
            "Sales tax in cents that would be refunded if the full refundable "
            "amount is refunded."
        ),
        examples=[720],
    )
    def refundable_tax_amount(self) -> int:
        return max(0, self.tax_amount - self.refunded_tax_amount)

    def get_amount_display(self) -> str:
        return format_currency(self.net_amount, self.currency)

    def get_refunded_amount_display(self) -> str:
        return format_currency(self.refunded_amount, self.currency)


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
    email: str | None = None
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
    user_id: SkipJsonSchema[UUID4] = Field(
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


class OrderCreate(MetadataInputMixin, CustomFieldDataInputMixin):
    """Schema to create a draft order for an off-session charge."""

    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization the order belongs to. "
            "**Required unless you use an organization token.** "
            "The customer and product must belong to this organization."
        ),
    )
    customer_id: UUID4 = Field(
        description="The ID of the customer the order is for. "
        "Must belong to the order's organization."
    )
    product_id: UUID4 = Field(
        description="The ID of the one-time, fixed-price product to charge for. "
        "Must belong to the order's organization. "
        "Subscription, seat-based, and pay-what-you-want products are not "
        "supported."
    )
    currency: str | None = Field(
        None,
        description=(
            "The currency to charge in (ISO 4217, lowercase, e.g. `usd`). "
            "Defaults to the organization's default currency; specify it to "
            "force a different one, or when the product isn't priced in the "
            "organization's default currency."
        ),
    )


class OrderUpdateBase(Schema):
    billing_name: str | None = Field(
        None, description="The name of the customer that should appear on the invoice."
    )
    billing_address: AddressInput | None = Field(
        None,
        description=(
            "The address of the customer that should appear on the invoice. "
            "Country and state fields cannot be updated."
        ),
    )


class OrderUpdate(OrderUpdateBase):
    """Schema to update an order."""


class OrderFinalize(Schema):
    """Schema to finalize a draft order and trigger an off-session charge."""

    payment_method_id: UUID4 | None = Field(
        None,
        description=(
            "ID of the payment method to charge. Must belong to the order's "
            "customer. Falls back to the customer's default payment method "
            "when unset."
        ),
    )


class OrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")


class OrderReceipt(Schema):
    """Order's receipt data."""

    url: str = Field(..., description="The URL to the receipt PDF.")
