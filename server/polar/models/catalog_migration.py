from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Integer, Uuid
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from polar.models import Organization, Product


class CatalogMigrationStatus(StrEnum):
    running = "running"
    completed = "completed"


class CatalogMigration(RecordModel):
    """A request to move the customers of older versions of a product to a
    newer one: subscriptions for a recurring product, the benefits of one-time
    orders otherwise."""

    __tablename__ = "catalog_migrations"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    source_product_ids: Mapped[list[UUID]] = mapped_column(ARRAY(Uuid), nullable=False)
    target_product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="restrict"),
        nullable=False,
        index=True,
    )
    status: Mapped[CatalogMigrationStatus] = mapped_column(
        StringEnum(CatalogMigrationStatus),
        nullable=False,
        default=CatalogMigrationStatus.running,
    )
    moved_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_processed_id: Mapped[UUID | None] = mapped_column(
        Uuid, nullable=True, default=None
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def target_product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise")
