from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Float,
    ForeignKey,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel


class PricingCompany(RecordModel):
    """A company we track in the pricing directory."""

    __tablename__ = "pricing_companies"

    slug: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    pricing_url: Mapped[str] = mapped_column(String, nullable=False)

    products: Mapped[list["PricingProduct"]] = relationship(
        "PricingProduct",
        lazy="raise",
        back_populates="company",
        cascade="all, delete-orphan",
    )


class PricingProduct(RecordModel):
    """A single priced product offered by a company.

    Carries denormalized "current" pricing so the directory listing can render
    without joining the full snapshot history. Each recorded change writes a
    `PricingSnapshot`.
    """

    __tablename__ = "pricing_products"

    company_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("pricing_companies.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    current_model: Mapped[str] = mapped_column(String, nullable=False)
    current_anchor: Mapped[str] = mapped_column(String, nullable=False)
    last_direction: Mapped[str] = mapped_column(String, nullable=False)
    last_change_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    # Hash of (model, anchor); lets us skip writing a snapshot when nothing moved.
    last_content_hash: Mapped[str | None] = mapped_column(String, nullable=True)

    company: Mapped["PricingCompany"] = relationship(
        "PricingCompany",
        lazy="raise",
        back_populates="products",
    )
    snapshots: Mapped[list["PricingSnapshot"]] = relationship(
        "PricingSnapshot",
        lazy="raise",
        back_populates="product",
        cascade="all, delete-orphan",
        order_by="desc(PricingSnapshot.captured_at)",
    )


class PricingSnapshot(RecordModel):
    """One recorded pricing change for a product — the timeline of history."""

    __tablename__ = "pricing_snapshots"

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("pricing_products.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    captured_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    model: Mapped[str] = mapped_column(String, nullable=False)
    anchor: Mapped[str] = mapped_column(String, nullable=False)
    direction: Mapped[str] = mapped_column(String, nullable=False)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    source_excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)

    product: Mapped["PricingProduct"] = relationship(
        "PricingProduct",
        lazy="raise",
        back_populates="snapshots",
    )
