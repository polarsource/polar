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
        UniqueConstraint("organization_id", "hash"),
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
    hash: Mapped[str] = mapped_column(String(64), nullable=False)
    parent_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("catalogs.id", ondelete="restrict"), nullable=True
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
        return relationship("Catalog", lazy="raise", remote_side="Catalog.id")
