from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid, func, select
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.orm import (
    Mapped,
    column_property,
    declared_attr,
    mapped_column,
    relationship,
)

from polar.kit.db.models.base import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from .customer import Customer
    from .organization import Organization


class WalletType(StrEnum):
    usage = "usage"
    billing = "billing"


class Wallet(RecordModel):
    __tablename__ = "wallets"
    __table_args__ = (UniqueConstraint("type", "currency", "customer_id"),)

    type: Mapped[WalletType] = mapped_column(StringEnum(WalletType), nullable=False)
    currency: Mapped[str] = mapped_column(String(3))
    customer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="cascade"),
        unique=True,
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise_on_sql")

    organization: AssociationProxy["Organization"] = association_proxy(
        "customer", "organization"
    )

    @declared_attr
    def balance(cls) -> Mapped[int]:
        from .wallet_transaction import WalletTransaction

        return column_property(
            select(func.coalesce(func.sum(WalletTransaction.amount), 0))
            .where(WalletTransaction.wallet_id == cls.id)
            .correlate_except(WalletTransaction)
            .scalar_subquery()
        )
