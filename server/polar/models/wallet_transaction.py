from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship
from sqlalchemy.sql.sqltypes import BigInteger

from polar.kit.db.models import IDModel
from polar.kit.utils import utc_now

if TYPE_CHECKING:
    from .order import Order
    from .refund import Refund
    from .wallet import Wallet


class WalletTransaction(IDModel):
    __tablename__ = "wallet_transactions"

    timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now, index=True
    )
    currency: Mapped[str] = mapped_column(String(3))
    amount: Mapped[int] = mapped_column(BigInteger)
    wallet_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("wallets.id", ondelete="restrict"), index=True
    )

    tax_amount: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, default=None
    )
    tax_calculation_processor_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    order_id: Mapped[UUID | None] = mapped_column(
        "order_id",
        Uuid,
        ForeignKey("orders.id", ondelete="restrict"),
        index=True,
        nullable=True,
    )

    refund_id: Mapped[UUID | None] = mapped_column(
        "refund_id",
        Uuid,
        ForeignKey("refunds.id", ondelete="restrict"),
        index=True,
        nullable=True,
    )

    @declared_attr
    def wallet(cls) -> Mapped["Wallet"]:
        return relationship("Wallet", lazy="raise_on_sql")

    @declared_attr
    def order(cls) -> Mapped["Order | None"]:
        return relationship("Order", lazy="raise_on_sql")

    @declared_attr
    def refund(cls) -> Mapped["Refund | None"]:
        return relationship("Refund", lazy="raise_on_sql")
