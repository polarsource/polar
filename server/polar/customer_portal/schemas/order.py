from datetime import datetime

from pydantic import UUID4, AliasChoices, AliasPath, Field
from pydantic.json_schema import SkipJsonSchema

from polar.enums import PaymentProcessor
from polar.kit.schemas import Schema
from polar.order.schemas import OrderBase, OrderItemSchema, OrderUpdateBase
from polar.organization.schemas import Organization
from polar.product.schemas import (
    BenefitPublicList,
    ProductBase,
    ProductMediaList,
    ProductPrice,
    ProductPriceList,
)
from polar.subscription.schemas import SubscriptionBase


class CustomerOrderProduct(ProductBase):
    prices: ProductPriceList
    benefits: BenefitPublicList
    medias: ProductMediaList
    organization: Organization


class CustomerOrderSubscription(SubscriptionBase): ...


class CustomerOrder(OrderBase):
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
    product_price: SkipJsonSchema[ProductPrice] = Field(
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
    next_payment_attempt_at: datetime | None = Field(
        None, description="When the next payment retry is scheduled"
    )


class CustomerOrderInvoice(Schema):
    """Order's invoice data."""

    url: str = Field(..., description="The URL to the invoice.")


class CustomerOrderUpdate(OrderUpdateBase):
    """Schema to update an order."""


class CustomerOrderPaymentStatus(Schema):
    """Payment status for an order."""

    status: str = Field(..., description="Current payment status.")
    error: str | None | None = Field(
        None, description="Error message if payment failed."
    )


class CustomerOrderConfirmPayment(Schema):
    """Schema to confirm a retry payment using a Stripe confirmation token."""

    confirmation_token_id: str = Field(
        ..., description="ID of the Stripe confirmation token."
    )
    payment_processor: PaymentProcessor = Field(
        PaymentProcessor.stripe, description="Payment processor used."
    )


class CustomerOrderPaymentConfirmation(Schema):
    """Response after confirming a retry payment."""

    status: str = Field(..., description="Payment status after confirmation.")
    client_secret: str | None = Field(
        None, description="Client secret for handling additional actions."
    )
    error: str | None = Field(None, description="Error message if confirmation failed.")
