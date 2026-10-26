from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import CreditNote


class CreditNoteItem(RecordModel):
    __tablename__ = "credit_note_items"

    description: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tax_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tax_details: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB(none_as_null=True), nullable=True, default=None
    )

    credit_note_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("credit_notes.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def credit_note(cls) -> Mapped["CreditNote"]:
        return relationship("CreditNote", lazy="raise", back_populates="items")
