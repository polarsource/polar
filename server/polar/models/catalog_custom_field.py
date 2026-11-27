from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Catalog, CustomField


class CatalogCustomField(RecordModel):
    __tablename__ = "catalog_custom_fields"
    __table_args__ = (
        UniqueConstraint("catalog_id", "custom_field_id"),
        UniqueConstraint("catalog_id", "slug"),
    )

    catalog_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("catalogs.id", ondelete="cascade"), nullable=False
    )
    custom_field_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("custom_fields.id", ondelete="restrict"),
        nullable=False,
        index=True,
    )
    slug: Mapped[str] = mapped_column(CITEXT, nullable=False)

    @declared_attr
    def catalog(cls) -> Mapped["Catalog"]:
        return relationship("Catalog", lazy="raise")

    @declared_attr
    def custom_field(cls) -> Mapped["CustomField"]:
        return relationship("CustomField", lazy="raise")
