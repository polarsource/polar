from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import (
    Boolean,
    ColumnElement,
    ForeignKey,
    String,
    Text,
    Uuid,
    select,
)
from sqlalchemy.dialects.postgresql import CITEXT
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.models.product_price import ProductPriceType

from .product_price import ProductPrice

if TYPE_CHECKING:
    from polar.models import Benefit, Organization, ProductBenefit, ProductMedia
    from polar.models.file import ProductMediaFile


class Product(RecordModel):
    __tablename__ = "products"

    name: Mapped[str] = mapped_column(CITEXT(), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    stripe_product_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @declared_attr
    def all_prices(cls) -> Mapped[list["ProductPrice"]]:
        return relationship("ProductPrice", lazy="raise", back_populates="product")

    @declared_attr
    def prices(cls) -> Mapped[list["ProductPrice"]]:
        # Prices are almost always needed, so eager loading makes sense
        return relationship(
            "ProductPrice",
            lazy="selectin",
            primaryjoin=(
                "and_("
                "ProductPrice.product_id == Product.id, "
                "ProductPrice.is_archived.is_(False)"
                ")"
            ),
            viewonly=True,
        )

    product_benefits: Mapped[list["ProductBenefit"]] = relationship(
        # Benefits are almost always needed, so eager loading makes sense
        lazy="selectin",
        order_by="ProductBenefit.order",
        cascade="all, delete-orphan",
        back_populates="product",
    )

    benefits: AssociationProxy[list["Benefit"]] = association_proxy(
        "product_benefits", "benefit"
    )

    product_medias: Mapped[list["ProductMedia"]] = relationship(
        lazy="raise",
        order_by="ProductMedia.order",
        cascade="all, delete-orphan",
        back_populates="product",
    )

    medias: AssociationProxy[list["ProductMediaFile"]] = association_proxy(
        "product_medias", "file"
    )

    @property
    def is_tax_applicable(self) -> bool:
        if len(self.prices) == 0:
            return False

        for benefit in self.benefits:
            if benefit.is_tax_applicable:
                return True

        return False

    def get_stripe_name(self) -> str:
        return f"{self.organization.slug} - {self.name}"

    def get_price(self, id: UUID) -> "ProductPrice | None":
        for price in self.prices:
            if price.id == id:
                return price
        return None

    @hybrid_property
    def is_recurring(self) -> bool:
        return all(price.is_recurring for price in self.prices)

    @is_recurring.inplace.expression
    @classmethod
    def _is_recurring_expression(cls) -> ColumnElement[bool]:
        return cls.id.not_in(
            select(ProductPrice.product_id).where(
                ProductPrice.type != ProductPriceType.recurring
            )
        )
