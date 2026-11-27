from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.address import Address, AddressType
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.tax.tax_id import TaxID, TaxIDType

if TYPE_CHECKING:
    from polar.models import CreditNoteItem, Order, Refund


class CreditNoteReason(StrEnum):
    duplicate = "duplicate"
    fraudulent = "fraudulent"
    customer_request = "customer_request"
    service_disruption = "service_disruption"
    satisfaction_guarantee = "satisfaction_guarantee"
    dispute_prevention = "dispute_prevention"
    tax_refund = "tax_refund"
    vat_reverse_charge_correction = "vat_reverse_charge_correction"
    other = "other"


class CreditNote(RecordModel):
    __tablename__ = "credit_notes"

    number: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False)
    reason: Mapped[CreditNoteReason] = mapped_column(
        StringEnum(CreditNoteReason), nullable=False
    )
    amount: Mapped[int] = mapped_column(BigInteger, nullable=False)
    tax_amount: Mapped[int] = mapped_column(BigInteger, nullable=False)

    billing_name: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    billing_address: Mapped[Address | None] = mapped_column(AddressType, nullable=True)
    tax_id: Mapped[TaxID | None] = mapped_column(TaxIDType, nullable=True, default=None)

    path: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    checksum: Mapped[str | None] = mapped_column(String, nullable=True, default=None)

    order_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("orders.id"), nullable=False, index=True
    )

    @declared_attr
    def order(cls) -> Mapped["Order"]:
        return relationship("Order", lazy="raise", back_populates="credit_notes")

    items: Mapped[list["CreditNoteItem"]] = relationship(
        "CreditNoteItem",
        back_populates="credit_note",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    @declared_attr
    def refunds(cls) -> Mapped[list["Refund"]]:
        return relationship("Refund", lazy="raise", back_populates="credit_note")

    @property
    def pdf_filename(self) -> str:
        return f"CreditNote-{self.number}.pdf"
