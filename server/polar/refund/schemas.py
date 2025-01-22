import inspect
from typing import Annotated, Any
from uuid import UUID

import stripe as stripe_lib
from babel.numbers import format_currency
from fastapi import Path
from pydantic import UUID4, Field

from polar.enums import PaymentProcessor
from polar.kit.metadata import (
    MetadataInputMixin,
    MetadataOutputMixin,
)
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.refund import (
    RefundFailureReason,
    RefundReason,
    RefundStatus,
)

RefundID = Annotated[UUID4, Path(description="The refund ID.")]


class Refund(MetadataOutputMixin, IDSchema, TimestampedSchema):
    status: RefundStatus
    reason: RefundReason
    amount: int
    tax_amount: int
    currency: str
    organization_id: UUID4
    order_id: UUID4
    subscription_id: UUID4 | None
    customer_id: UUID4
    revoke_benefits: bool

    def get_amount_display(self) -> str:
        return f"{format_currency(
            self.amount / 100,
            self.currency.upper(),
            locale="en_US",
        )}"


class RefundCreate(MetadataInputMixin, Schema):
    order_id: UUID4
    reason: RefundReason
    amount: int
    comment: str | None = Field(
        None,
        description="An internal comment about the refund.",
    )
    revoke_benefits: bool = Field(
        False,
        description=inspect.cleandoc(
            """
            Should this refund trigger the associated customer benefits to be revoked?

            **Note:**
            Only allowed in case the `order` is a one-time purchase.
            Subscriptions automatically revoke customer benefits once the
            subscription itself is revoked, i.e fully canceled.
            """
        ),
    )


class InternalRefundCreate(MetadataInputMixin, Schema):
    status: RefundStatus
    reason: RefundReason
    amount: int
    tax_amount: int
    currency: str
    comment: str | None = None
    failure_reason: RefundFailureReason | None
    destination_details: dict[str, Any] = {}
    order_id: UUID | None
    subscription_id: UUID | None
    customer_id: UUID | None
    organization_id: UUID | None
    pledge_id: UUID | None
    processor: PaymentProcessor
    processor_id: str
    processor_receipt_number: str | None
    processor_reason: str
    processor_balance_transaction_id: str | None
    revoke_benefits: bool = False

    @classmethod
    def from_stripe(
        cls,
        stripe_refund: stripe_lib.Refund,
        *,
        refunded_amount: int,
        refunded_tax_amount: int,
        order_id: UUID | None = None,
        subscription_id: UUID | None = None,
        customer_id: UUID | None = None,
        organization_id: UUID | None = None,
        pledge_id: UUID | None = None,
    ) -> "InternalRefundCreate":
        failure_reason = getattr(stripe_refund, "failure_reason", None)
        failure_reason = RefundFailureReason.from_stripe(failure_reason)
        stripe_reason = stripe_refund.reason if stripe_refund.reason else "other"
        reason = RefundReason.from_stripe(stripe_refund.reason)

        destination_details: dict[str, Any] = {}
        if stripe_refund.destination_details:
            destination_details = stripe_refund.destination_details

        status = RefundStatus.pending
        if stripe_refund.status:
            status = RefundStatus(stripe_refund.status)

        balance_transaction_id = None
        if stripe_refund.balance_transaction:
            balance_transaction_id = str(stripe_refund.balance_transaction)

        # Skip validation from trusted source (Stripe)
        return cls.model_construct(
            status=status,
            reason=reason,
            amount=refunded_amount,
            tax_amount=refunded_tax_amount,
            currency=stripe_refund.currency,
            failure_reason=failure_reason,
            destination_details=destination_details,
            order_id=order_id,
            subscription_id=subscription_id,
            customer_id=customer_id,
            organization_id=organization_id,
            pledge_id=pledge_id,
            revoke_benefits=False,
            processor=PaymentProcessor.stripe,
            processor_id=stripe_refund.id,
            processor_receipt_number=stripe_refund.receipt_number,
            processor_reason=stripe_reason,
            processor_balance_transaction_id=balance_transaction_id,
        )


class InternalRefundUpdate(MetadataInputMixin, Schema):
    id: UUID
