from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal, Self
from uuid import UUID

import stripe as stripe_lib
from sqlalchemy import (
    Boolean,
    ColumnElement,
    ForeignKey,
    Integer,
    String,
    Uuid,
    type_coerce,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import PaymentProcessor
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from polar.models import (
        Customer,
        Dispute,
        Order,
        Organization,
        Payment,
        Pledge,
        Subscription,
    )


class RefundStatus(StrEnum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"
    canceled = "canceled"


# Decoupled from Stripe
# 1) Allowing more reasons (good signals)
# 2) Allowing us to enable merchants to set `fraudulent` without automatically
#    tagging it as such on Stripe.
class RefundReason(StrEnum):
    duplicate = "duplicate"
    fraudulent = "fraudulent"
    customer_request = "customer_request"
    service_disruption = "service_disruption"
    satisfaction_guarantee = "satisfaction_guarantee"
    dispute_prevention = "dispute_prevention"
    other = "other"

    @classmethod
    def from_stripe(
        cls,
        reason: (
            Literal[
                "duplicate",
                "expired_uncaptured_charge",
                "fraudulent",
                "requested_by_customer",
            ]
            | None
        ),
    ) -> "RefundReason":
        if reason == "requested_by_customer":
            return cls.customer_request
        elif reason == "fraudulent":
            return cls.fraudulent
        elif reason == "duplicate":
            return cls.duplicate
        return cls.other

    @classmethod
    def to_stripe(
        cls, reason: "RefundReason"
    ) -> Literal["requested_by_customer", "duplicate"]:
        if reason == cls.duplicate:
            return "duplicate"

        # Avoid directly setting fraudulent since that blocks customers and can
        # be abused, i.e we should monitor our own fraudulent status and set it
        # retroactively on Stripe.
        return "requested_by_customer"


class RefundFailureReason(StrEnum):
    unknown = "unknown"
    declined = "declined"
    card_expired = "card_expired"
    card_lost = "card_lost"
    disputed = "disputed"
    insufficient_funds = "insufficient_funds"
    merchant_request = "merchant_request"

    @classmethod
    def from_stripe(cls, reason: str | None) -> "RefundFailureReason | None":
        if reason is None:
            return None

        if reason == "lost_or_stolen_card":
            return cls.card_lost
        elif reason == "expired_or_canceled_card":
            return cls.card_expired
        elif reason == "charge_for_pending_refund_disputed":
            return cls.disputed
        elif reason == "insufficient_funds":
            return cls.insufficient_funds
        elif reason == "merchant_request":
            return cls.merchant_request
        return cls.unknown


class Refund(MetadataMixin, RecordModel):
    __tablename__ = "refunds"

    status: Mapped[RefundStatus] = mapped_column(String, nullable=False)
    reason: Mapped[RefundReason] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    comment: Mapped[str | None] = mapped_column(String, nullable=True)

    failure_reason: Mapped[RefundFailureReason | None] = mapped_column(
        String, nullable=True
    )

    destination_details: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    payment_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("payments.id"), nullable=False, index=True
    )

    @declared_attr
    def payment(cls) -> Mapped["Payment"]:
        return relationship("Payment", lazy="raise")

    order_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("orders.id"), nullable=True, index=True
    )

    @declared_attr
    def order(cls) -> Mapped["Order | None"]:
        return relationship("Order", lazy="raise")

    subscription_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("subscriptions.id"), nullable=True, index=True
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription | None"]:
        return relationship("Subscription", lazy="raise")

    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=True, index=True
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization | None"]:
        return relationship("Organization", lazy="raise")

    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("customers.id"), nullable=True, index=True
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer | None"]:
        return relationship("Customer", lazy="raise")

    pledge_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("pledges.id"),
        nullable=True,
    )

    @declared_attr
    def pledge(cls) -> Mapped["Pledge | None"]:
        return relationship("Pledge", lazy="raise")

    dispute_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("disputes.id"), nullable=True
    )

    @declared_attr
    def dispute(cls) -> Mapped["Dispute | None"]:
        return relationship("Dispute", lazy="raise")

    # Created refund was set to revoke customer benefits?
    revoke_benefits: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
    )

    processor: Mapped[PaymentProcessor] = mapped_column(
        String,
        nullable=False,
    )
    processor_id: Mapped[str] = mapped_column(
        String,
        nullable=False,
        unique=True,
        index=True,
    )
    processor_reason: Mapped[str] = mapped_column(String, nullable=False)
    processor_receipt_number: Mapped[str | None] = mapped_column(String, nullable=True)
    processor_balance_transaction_id: Mapped[str | None] = mapped_column(
        String, nullable=True
    )

    tax_transaction_processor_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    @hybrid_property
    def succeeded(self) -> bool:
        return self.status == RefundStatus.succeeded

    @succeeded.inplace.expression
    @classmethod
    def _succeeded_expression(cls) -> ColumnElement[bool]:
        return type_coerce(
            cls.status.in_(RefundStatus.succeeded),
            Boolean,
        )

    @hybrid_property
    def total_amount(self) -> int:
        return self.amount + self.tax_amount

    @total_amount.inplace.expression
    @classmethod
    def _total_amount_expression(cls) -> ColumnElement[int]:
        return cls.amount + cls.tax_amount

    @classmethod
    def from_stripe(
        cls, stripe_refund: stripe_lib.Refund, order: Order, payment: Payment
    ) -> Self:
        amount, tax_amount = order.calculate_refunded_tax_from_total(
            stripe_refund.amount
        )

        failure_reason = getattr(stripe_refund, "failure_reason", None)
        failure_reason = RefundFailureReason.from_stripe(failure_reason)
        stripe_reason = stripe_refund.reason if stripe_refund.reason else "other"
        reason = RefundReason.from_stripe(stripe_refund.reason)

        status = RefundStatus.pending
        if stripe_refund.status:
            status = RefundStatus(stripe_refund.status)

        balance_transaction_id: str | None = None
        if stripe_refund.balance_transaction:
            balance_transaction_id = str(stripe_refund.balance_transaction)

        return cls(
            status=status,
            reason=reason,
            amount=amount,
            tax_amount=tax_amount,
            currency=stripe_refund.currency,
            failure_reason=failure_reason,
            destination_details=getattr(stripe_refund, "destination_details", {}),
            payment=payment,
            order=order,
            subscription=order.subscription,
            organization=order.organization,
            customer=order.customer,
            pledge=None,
            dispute=None,
            processor=PaymentProcessor.stripe,
            processor_id=stripe_refund.id,
            processor_reason=stripe_reason,
            processor_receipt_number=stripe_refund.receipt_number,
            processor_balance_transaction_id=balance_transaction_id,
        )
