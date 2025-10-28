from enum import StrEnum
from typing import TYPE_CHECKING, Any, Literal, Self
from uuid import UUID

from sqlalchemy import ColumnElement, ForeignKey, SmallInteger, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship
from sqlalchemy.sql.sqltypes import Integer

from polar.enums import PaymentProcessor
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StrEnumType

if TYPE_CHECKING:
    from .checkout import Checkout
    from .order import Order
    from .organization import Organization
    from .wallet import Wallet


class PaymentStatus(StrEnum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"

    @classmethod
    def from_stripe_charge(
        cls, stripe_status: Literal["failed", "pending", "succeeded"]
    ) -> Self:
        return cls(stripe_status)


class Payment(RecordModel):
    __tablename__ = "payments"

    processor: Mapped[PaymentProcessor] = mapped_column(
        StrEnumType(PaymentProcessor), index=True, nullable=False
    )
    status: Mapped[PaymentStatus] = mapped_column(
        StrEnumType(PaymentStatus), index=True, nullable=False
    )
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    method: Mapped[str] = mapped_column(String, index=True, nullable=False)
    method_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    processor_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    customer_email: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )

    processor_id: Mapped[str] = mapped_column(
        String, index=True, nullable=False, unique=True
    )

    decline_reason: Mapped[str | None] = mapped_column(String, nullable=True)
    decline_message: Mapped[str | None] = mapped_column(String, nullable=True)

    risk_level: Mapped[str | None] = mapped_column(String, nullable=True)
    risk_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    checkout_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("checkouts.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def checkout(cls) -> Mapped["Checkout | None"]:
        return relationship("Checkout", lazy="raise")

    wallet_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("wallets.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def wallet(cls) -> Mapped["Wallet | None"]:
        return relationship("Wallet", lazy="raise")

    order_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("orders.id", ondelete="set null"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def order(cls) -> Mapped["Order | None"]:
        return relationship("Order", lazy="raise")

    @hybrid_property
    def is_succeeded(self) -> bool:
        return self.status == PaymentStatus.succeeded

    @is_succeeded.inplace.expression
    @classmethod
    def _is_succeeded_expression(cls) -> ColumnElement[bool]:
        return cls.status == PaymentStatus.succeeded

    @hybrid_property
    def is_failed(self) -> bool:
        return self.status == PaymentStatus.failed

    @is_failed.inplace.expression
    @classmethod
    def _is_failed_expression(cls) -> ColumnElement[bool]:
        return cls.status == PaymentStatus.failed
