from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Index,
    String,
    Uuid,
    func,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.address import Address, AddressType
from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin
from polar.kit.tax import TaxID, TaxIDType

if TYPE_CHECKING:
    from .organization import Organization


class Customer(MetadataMixin, RecordModel):
    __tablename__ = "customers"
    __table_args__ = (
        Index("ix_customers_email_case_insensitive", func.lower(Column("email"))),
        Index(
            "ix_customers_organization_id_email_case_insensitive",
            "organization_id",
            func.lower(Column("email")),
            unique=True,
        ),
    )

    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    stripe_customer_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None, unique=True
    )

    name: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    billing_address: Mapped[Address | None] = mapped_column(
        AddressType, nullable=True, default=None
    )
    tax_id: Mapped[TaxID | None] = mapped_column(TaxIDType, nullable=True, default=None)

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")
