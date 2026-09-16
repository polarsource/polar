import uuid
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    ForeignKey,
    ForeignKeyConstraint,
    Numeric,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization
    from .void_reducer import VoidReducer


class VoidMeter(RecordModel):
    __tablename__ = "void_meters"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "usage_reducer_id"],
            ["void_reducers.organization_id", "void_reducers.id"],
        ),
        ForeignKeyConstraint(
            ["organization_id", "credit_reducer_id"],
            ["void_reducers.organization_id", "void_reducers.id"],
        ),
        UniqueConstraint("organization_id", "slug", "version_id"),
    )

    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str] = mapped_column(String, nullable=False)
    version_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    usage_reducer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False, index=True
    )
    credit_reducer_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, nullable=False, index=True
    )
    unit_amount: Mapped[Decimal] = mapped_column(Numeric(17, 12), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")

    usage_reducer: Mapped["VoidReducer"] = relationship(
        foreign_keys=[usage_reducer_id], lazy="raise"
    )
    credit_reducer: Mapped["VoidReducer"] = relationship(
        foreign_keys=[credit_reducer_id], lazy="raise"
    )
