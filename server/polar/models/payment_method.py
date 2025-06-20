from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import PaymentProcessor
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StrEnumType

if TYPE_CHECKING:
    from .customer import Customer


class PaymentMethod(RecordModel):
    __tablename__ = "payment_methods"
    __table_args__ = (UniqueConstraint("processor", "processor_id", "customer_id"),)

    processor: Mapped[PaymentProcessor] = mapped_column(
        StrEnumType(PaymentProcessor), index=True, nullable=False
    )
    processor_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    type: Mapped[str] = mapped_column(String, index=True, nullable=False)
    method_metadata: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("customers.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship(
            "Customer",
            lazy="raise",
            back_populates="payment_methods",
            foreign_keys=[cls.customer_id],  # type: ignore
        )
