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
    # "active" while seen on the page, "legacy" once it disappears.
    status: Mapped[str] = mapped_column(
        String, nullable=False, default="active", server_default="active", index=True
    )
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
    metrics: Mapped[list["PricingMetric"]] = relationship(
        "PricingMetric",
        lazy="raise",
        back_populates="product",
        cascade="all, delete-orphan",
    )
    features: Mapped[list["PricingFeature"]] = relationship(
        "PricingFeature",
        lazy="raise",
        back_populates="product",
        cascade="all, delete-orphan",
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


class PricingMetric(RecordModel):
    """A normalized per-unit price for a product (e.g. $/M tokens, $/GB-month).

    This is the structured layer that powers cross-provider comparison: filter
    by `unit` and rank by `amount / per_quantity`.
    """

    __tablename__ = "pricing_metrics"

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("pricing_products.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    # What the price is for, e.g. "Input tokens", "GPU-second", "Storage".
    label: Mapped[str] = mapped_column(String, nullable=False)
    # Canonical unit, e.g. "tokens", "seat", "gb_month", "gpu_second".
    unit: Mapped[str] = mapped_column(String, nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    # Quantity the amount covers (1, 1000, 1_000_000), so amount/per_quantity
    # is the price of a single unit, comparable across providers.
    per_quantity: Mapped[float] = mapped_column(Float, nullable=False, default=1)
    currency: Mapped[str] = mapped_column(String, nullable=False, default="USD")
    raw: Mapped[str | None] = mapped_column(String, nullable=True)

    product: Mapped["PricingProduct"] = relationship(
        "PricingProduct",
        lazy="raise",
        back_populates="metrics",
    )


class PricingFeature(RecordModel):
    """A feature, benefit, or entitlement included in a product/plan.

    `category` groups features into themes; `key` is a normalized slug so the
    same feature can be compared across companies (e.g. every plan with 'sso').
    """

    __tablename__ = "pricing_features"

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("pricing_products.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    key: Mapped[str] = mapped_column(String, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String, nullable=False, index=True)
    value: Mapped[str | None] = mapped_column(String, nullable=True)

    product: Mapped["PricingProduct"] = relationship(
        "PricingProduct",
        lazy="raise",
        back_populates="features",
    )
