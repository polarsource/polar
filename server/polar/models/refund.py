from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

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

from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from polar.models import (
        Order,
        Pledge,
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
    other = "other"


STRIPE_REASON_MAPPING = {
    "duplicate": RefundReason.duplicate,
    "fraudulent": RefundReason.fraudulent,
    "requested_by_customer": RefundReason.customer_request,
}


def reason_from_stripe(reason: str | None) -> RefundReason:
    if reason is None:
        return RefundReason.other

    return STRIPE_REASON_MAPPING.get(reason, RefundReason.other)


class RefundFailureReason(StrEnum):
    unknown = "unknown"
    declined = "declined"
    card_expired = "card_expired"
    card_lost = "card_lost"
    disputed = "disputed"
    insufficient_funds = "insufficient_funds"
    merchant_request = "merchant_request"


STRIPE_FAILURE_REASON_MAPPING = {
    "lost_or_stolen_card": RefundFailureReason.card_lost,
    "expired_or_canceled_card": RefundFailureReason.card_expired,
    "charge_for_pending_refund_disputed": RefundFailureReason.disputed,
    "insufficient_funds": RefundFailureReason.insufficient_funds,
    "merchant_request": RefundFailureReason.merchant_request,
    "unknown": RefundFailureReason.unknown,
}


def failure_reason_from_stripe(stripe_reason: str | None) -> RefundFailureReason | None:
    if stripe_reason is None:
        return None

    return STRIPE_FAILURE_REASON_MAPPING.get(
        stripe_reason,
        RefundFailureReason.unknown,
    )


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

    stripe_id: Mapped[str | None] = mapped_column(
        String,
        nullable=False,
        unique=True,
        index=True,
    )
    stripe_reason: Mapped[str] = mapped_column(String, nullable=False)
    stripe_receipt_number: Mapped[str | None] = mapped_column(String, nullable=True)

    order_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("orders.id"),
        nullable=True,
    )

    @declared_attr
    def order(cls) -> Mapped["Order"]:
        return relationship("Order", lazy="raise")

    pledge_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("pledges.id"),
        nullable=True,
    )

    @declared_attr
    def pledge(cls) -> Mapped["Pledge"]:
        return relationship("Pledge", lazy="raise")

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
