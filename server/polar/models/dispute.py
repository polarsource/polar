from enum import StrEnum
from typing import TYPE_CHECKING, Literal
from uuid import UUID

from sqlalchemy import (
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
            case "warning_closed":
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
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
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
