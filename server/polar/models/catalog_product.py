from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Catalog, Product


class CatalogProduct(RecordModel):
    __tablename__ = "catalog_products"
    __table_args__ = (
        UniqueConstraint("catalog_id", "product_id"),
        UniqueConstraint("catalog_id", "external_id"),
    )

    catalog_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("catalogs.id", ondelete="cascade"), nullable=False
    )
    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="restrict"),
        nullable=False,
        index=True,
    )
    external_id: Mapped[str] = mapped_column(String, nullable=False)

    @declared_attr
    def catalog(cls) -> Mapped["Catalog"]:
        return relationship("Catalog", lazy="raise")

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise")
