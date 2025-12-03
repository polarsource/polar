from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from polar.models import Order, Payment, Refund


class DisputeStatus(StrEnum):
    prevented = "prevented"
    early_warning = "early_warning"
    needs_response = "needs_response"
    under_review = "under_review"
    lost = "lost"
    won = "won"


class DisputeAlertProcessor(StrEnum):
    chargeback_stop = "chargeback_stop"


class Dispute(RecordModel):
    __tablename__ = "disputes"

    status: Mapped[DisputeStatus] = mapped_column(
        StringEnum(DisputeStatus), nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    tax_amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)

    payment_processor_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True, unique=True
    )
    dispute_alert_processor: Mapped[DisputeAlertProcessor | None] = mapped_column(
        StringEnum(DisputeAlertProcessor), nullable=True
    )
    dispute_alert_processor_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True, unique=True
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

    refund_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("refunds.id"), nullable=True
    )

    @declared_attr
    def refund(cls) -> Mapped["Refund | None"]:
        return relationship("Refund", lazy="raise")
