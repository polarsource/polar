from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Catalog, Meter


class CatalogMeter(RecordModel):
    __tablename__ = "catalog_meters"
    __table_args__ = (
        UniqueConstraint("catalog_id", "meter_id"),
        UniqueConstraint("catalog_id", "external_id"),
    )

    catalog_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("catalogs.id", ondelete="cascade"), nullable=False
    )
    meter_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("meters.id", ondelete="restrict"),
        nullable=False,
        index=True,
    )
    external_id: Mapped[str] = mapped_column(String, nullable=False)

    @declared_attr
    def catalog(cls) -> Mapped["Catalog"]:
        return relationship("Catalog", lazy="raise")

    @declared_attr
    def meter(cls) -> Mapped["Meter"]:
        return relationship("Meter", lazy="raise")
