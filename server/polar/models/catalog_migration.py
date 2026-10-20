from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Catalog, Organization


class CatalogMigration(RecordModel):
    __tablename__ = "catalog_migrations"
    __table_args__ = (UniqueConstraint("organization_id", "external_id"),)

    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="cascade"), nullable=False
    )
    external_id: Mapped[str] = mapped_column(String, nullable=False)
    catalog_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("catalogs.id", ondelete="restrict"), nullable=False
    )
    source_external_id: Mapped[str] = mapped_column(String, nullable=False)
    target_external_id: Mapped[str] = mapped_column(String, nullable=False)
    subscriptions_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_subscription_id: Mapped[UUID | None] = mapped_column(
        Uuid, nullable=True, default=None
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def catalog(cls) -> Mapped["Catalog"]:
        return relationship("Catalog", lazy="raise")
