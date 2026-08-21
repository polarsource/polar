from typing import Annotated, Any, Literal

from fastapi import Path
from pydantic import UUID4, Field, TypeAdapter

from polar.enums import PaymentProcessor
from polar.kit.schemas import (
    CHECKOUT_ID_EXAMPLE,
    ORGANIZATION_ID_EXAMPLE,
    ClassName,
    IDSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.models.payment import PaymentStatus, PaymentTrigger

PaymentID = Annotated[UUID4, Path(description="The payment ID.")]


class PaymentBase(IDSchema, TimestampedSchema):
    processor: PaymentProcessor = Field(
        description="The payment processor.", examples=[PaymentProcessor.stripe]
    )
    status: PaymentStatus = Field(
        description="The payment status.", examples=[PaymentStatus.succeeded]
    )
    amount: int = Field(description="The payment amount in cents.", examples=[1000])
    currency: str = Field(
        description="The payment currency",
        examples=["usd"],
    )
    method: str = Field(description="The payment method used.", examples=["card"])
    trigger: PaymentTrigger | None = Field(
        description=(
            "What initiated this payment attempt, e.g. initial purchase, "
            "subscription renewal, or an automated dunning retry."
        ),
        examples=[PaymentTrigger.subscription_cycle],
    )
    decline_reason: str | None = Field(
        description="Error code, if the payment was declined.",
        examples=["insufficient_funds"],
    )
    decline_message: str | None = Field(
        description="Human-readable error message, if the payment was declined.",
        examples=["Your card has insufficient funds."],
    )
    organization_id: UUID4 = Field(
        description="The ID of the organization that owns the payment.",
        examples=[ORGANIZATION_ID_EXAMPLE],
    )
    checkout_id: UUID4 | None = Field(
        description="The ID of the checkout session associated with this payment.",
        examples=[CHECKOUT_ID_EXAMPLE],
    )
    order_id: UUID4 | None = Field(
        description="The ID of the order associated with this payment.",
        examples=[CHECKOUT_ID_EXAMPLE],
    )
    processor_metadata: dict[str, Any] = Field(
        description="Additional metadata from the payment processor for internal use.",
        default_factory=dict,
    )


class GenericPayment(PaymentBase):
    """Schema of a payment with a generic payment method."""


class CardPaymentMetadata(Schema):
    """Additional metadata for a card payment method."""

    brand: str = Field(
        description="The brand of the card used for the payment.",
        examples=["visa", "amex"],
    )
    last4: str = Field(
        description="The last 4 digits of the card number.", examples=["4242"]
    )


class CardPayment(PaymentBase):
    """Schema of a payment with a card payment method."""

    method: Literal["card"] = Field(
        description="The payment method used.", examples=["card"]
    )
    method_metadata: CardPaymentMetadata = Field(
        description="Additional metadata for the card payment method."
    )


class KrCardPaymentMetadata(Schema):
    """Additional metadata for a South Korean card payment method."""

    brand: str | None = Field(
        description="The local South Korean card brand used for the payment.",
        examples=["kookmin", "shinhan"],
    )
    last4: str | None = Field(
        description="The last 4 digits of the card number.", examples=["4242"]
    )


class KrCardPayment(PaymentBase):
    """Schema of a payment with a South Korean card payment method."""

    method: Literal["kr_card"] = Field(
        description="The payment method used.", examples=["kr_card"]
    )
    method_metadata: KrCardPaymentMetadata = Field(
        description="Additional metadata for the South Korean card payment method."
    )


Payment = Annotated[
    CardPayment | KrCardPayment | GenericPayment,
    SetSchemaReference("Payment"),
    ClassName("Payment"),
]

PaymentAdapter: TypeAdapter[Payment] = TypeAdapter(Payment)
