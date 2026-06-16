from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Boolean,
    ColumnElement,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import PaymentProcessor
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from polar.models import Order, Payment


class DisputeStatus(StrEnum):
    prevented = "prevented"
    early_warning = "early_warning"
    needs_response = "needs_response"
    under_review = "under_review"
    lost = "lost"
    won = "won"

    @classmethod
    def resolved_statuses(cls) -> set["DisputeStatus"]:
        return {cls.lost, cls.won}

    @classmethod
    def closed_statuses(cls) -> set["DisputeStatus"]:
        return {cls.prevented, cls.lost, cls.won}

    @classmethod
    def from_stripe(
        cls,
        status: Literal[
            "lost",
            "needs_response",
            "prevented",
            "under_review",
            "warning_closed",
            "warning_needs_response",
            "warning_under_review",
            "won",
        ],
    ) -> "DisputeStatus":
        match status:
            case "lost":
                return DisputeStatus.lost
            case "needs_response" | "warning_needs_response":
                return DisputeStatus.needs_response
            case "under_review" | "warning_under_review":
                return DisputeStatus.under_review
            case "won":
                return DisputeStatus.won
            case "warning_closed" | "prevented":
                return DisputeStatus.prevented


class DisputeAlertProcessor(StrEnum):
    chargeback_stop = "chargeback_stop"


class Dispute(RecordModel):
    __tablename__ = "disputes"
    __table_args__ = (
        UniqueConstraint("payment_processor", "payment_processor_id"),
        UniqueConstraint("dispute_alert_processor", "dispute_alert_processor_id"),
    )

    status: Mapped[DisputeStatus] = mapped_column(
        StringEnum(DisputeStatus), nullable=False
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tax_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    payment_processor: Mapped[PaymentProcessor | None] = mapped_column(
        StringEnum(PaymentProcessor), nullable=True
    )
    payment_processor_id: Mapped[str | None] = mapped_column(String, nullable=True)
    dispute_alert_processor: Mapped[DisputeAlertProcessor | None] = mapped_column(
        StringEnum(DisputeAlertProcessor), nullable=True
    )
    dispute_alert_processor_id: Mapped[str | None] = mapped_column(
        String, nullable=True
    )

    # Details from the processor's dispute object (Stripe). Null until we get
    # the dispute webhook: ChargebackStop early-warnings arrive first, without
    # it. `evidence_due_by` is the deadline to respond; the rest is submission
    # state, kept in sync by the `charge.dispute.updated` webhook.
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    network_reason_code: Mapped[str | None] = mapped_column(String, nullable=True)
    evidence_due_by: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    # Nullable for now: added without a DB backfill, populated app-side going
    # forward (`default`) and backfilled for historical rows by
    # `scripts/backfill_dispute_evidence_state.py`. A follow-up makes them
    # non-nullable once the backfill has run.
    has_evidence: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True, default=False
    )
    past_due: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=False)
    submission_count: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=0
    )

    order_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("orders.id"), nullable=False, index=True
    )

    @declared_attr
    def order(cls) -> Mapped["Order"]:
        return relationship("Order", lazy="raise")

    payment_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("payments.id"), nullable=False, index=True
    )

    @declared_attr
    def payment(cls) -> Mapped["Payment"]:
        return relationship("Payment", lazy="raise")

    @hybrid_property
    def resolved(self) -> bool:
        return self.status in DisputeStatus.resolved_statuses()

    @resolved.inplace.expression
    @classmethod
    def _resolved_expression(cls) -> ColumnElement[bool]:
        return cls.status.in_(DisputeStatus.resolved_statuses())

    @hybrid_property
    def closed(self) -> bool:
        return self.status in DisputeStatus.closed_statuses()

    @closed.inplace.expression
    @classmethod
    def _closed_expression(cls) -> ColumnElement[bool]:
        return cls.status.in_(DisputeStatus.closed_statuses())
