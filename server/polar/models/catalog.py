from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from polar.models import Organization


class CatalogStatus(StrEnum):
    draft = "draft"
    live = "live"
    archived = "archived"


class Catalog(RecordModel):
    __tablename__ = "catalogs"
    __table_args__ = (
        UniqueConstraint("organization_id", "version_hash"),
        Index(
            "ix_catalogs_organization_id_live",
            "organization_id",
            unique=True,
            postgresql_where=text("status = 'live' AND deleted_at IS NULL"),
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="cascade"), nullable=False
    )
    version_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, default=None
    )
    name: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    parent_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("catalogs.id", ondelete="set null"),
        nullable=True,
        default=None,
    )
    status: Mapped[CatalogStatus] = mapped_column(
        StringEnum(CatalogStatus), nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def parent(cls) -> Mapped["Catalog | None"]:
        return relationship("Catalog", remote_side="Catalog.id", lazy="raise")
