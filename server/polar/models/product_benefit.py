from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Benefit, Product


class ProductBenefit(RecordModel):
    __tablename__ = "product_benefits"
    __table_args__ = (UniqueConstraint("product_id", "order"),)

    product_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("products.id", ondelete="cascade"),
        primary_key=True,
    )
    benefit_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("benefits.id", ondelete="cascade"),
        primary_key=True,
    )
    order: Mapped[int] = mapped_column(Integer, index=True, nullable=False)

    @declared_attr
    def product(cls) -> Mapped["Product"]:
        return relationship("Product", lazy="raise", back_populates="product_benefits")

    @declared_attr
    def benefit(cls) -> Mapped["Benefit"]:
        # This is an association table, so eager loading makes sense
        return relationship("Benefit", lazy="joined")
