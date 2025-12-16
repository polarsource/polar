from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger
from alembic_utils.replaceable_entity import register_entities
from sqlalchemy import (
    Boolean,
    ColumnElement,
    ForeignKey,
    Index,
    Integer,
    Text,
    Uuid,
    case,
    or_,
    select,
)
from sqlalchemy.dialects.postgresql import CITEXT, TSVECTOR
from sqlalchemy.ext.associationproxy import AssociationProxy, association_proxy
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum
from polar.kit.metadata import MetadataMixin
from polar.kit.tax import TaxCode
from polar.kit.trial import TrialConfigurationMixin
from polar.models.product_price import ProductPriceAmountType, ProductPriceType

from .product_price import ProductPrice

if TYPE_CHECKING:
    from polar.models import (
        Benefit,
        Organization,
        ProductBenefit,
        ProductCustomField,
        ProductMedia,
    )
    from polar.models.file import ProductMediaFile


class ProductBillingType(StrEnum):
    one_time = "one_time"
    recurring = "recurring"


class Product(TrialConfigurationMixin, MetadataMixin, RecordModel):
    __tablename__ = "products"
    __table_args__ = (
        Index(
            "ix_products_search_vector",
            "search_vector",
            postgresql_using="gin",
        ),
    )

    search_vector: Mapped[str] = mapped_column(TSVECTOR, nullable=True)

    name: Mapped[str] = mapped_column(CITEXT(), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    recurring_interval: Mapped[SubscriptionRecurringInterval | None] = mapped_column(
        StringEnum(SubscriptionRecurringInterval),
        nullable=True,
        index=True,
        default=None,
    )
    recurring_interval_count: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    is_tax_applicable: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
    tax_code: Mapped[TaxCode] = mapped_column(
        StringEnum(TaxCode),
        nullable=False,
        default=TaxCode.general_electronically_supplied_services,
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise", back_populates="products")

    @declared_attr
    def all_prices(cls) -> Mapped[list["ProductPrice"]]:
        return relationship(
            "ProductPrice", lazy="raise", cascade="all", back_populates="product"
        )

    @declared_attr
    def prices(cls) -> Mapped[list["ProductPrice"]]:
        # Prices are almost always needed, so eager loading makes sense
        return relationship(
            "ProductPrice",
            lazy="selectin",
            primaryjoin=(
                "and_("
                "ProductPrice.product_id == Product.id, "
                "ProductPrice.is_archived.is_(False), "
                "ProductPrice.source == 'catalog'"
                ")"
            ),
            order_by="(case("
            "(ProductPrice.amount_type.in_(['fixed', 'custom', 'free']), 0), "
            "(ProductPrice.amount_type == 'metered_unit', 1), "
            "), ProductPrice.created_at)",
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

    attached_custom_fields: Mapped[list["ProductCustomField"]] = relationship(
        lazy="raise",
        order_by="ProductCustomField.order",
        cascade="all, delete-orphan",
        back_populates="product",
    )

    def get_price(
        self, id: UUID, *, include_archived: bool = False
    ) -> "ProductPrice | None":
        prices = self.all_prices if include_archived else self.prices
        for price in prices:
            if price.id == id:
                return price
        return None

    def get_static_price(
        self, *, include_archived: bool = False
    ) -> "ProductPrice | None":
        prices = self.all_prices if include_archived else self.prices
        for price in prices:
            if price.is_static:
                return price
        return None

    @property
    def is_legacy_recurring_price(self) -> bool:
        return any(price.is_recurring for price in self.prices)

    @property
    def has_seat_based_price(self) -> bool:
        return any(
            price.amount_type == ProductPriceAmountType.seat_based
            for price in self.prices
        )

    @hybrid_property
    def is_recurring(self) -> bool:
        if self.recurring_interval is not None:
            return True

        # Check for Products that have legacy prices where recurring interval was set on them
        return all(price.is_recurring for price in self.prices)

    @is_recurring.inplace.expression
    @classmethod
    def _is_recurring_expression(cls) -> ColumnElement[bool]:
        return or_(
            cls.recurring_interval.is_not(None),
            # Check for Products that have legacy prices where recurring interval was set on them
            cls.id.in_(
                select(ProductPrice.product_id).where(
                    ProductPrice.type == ProductPriceType.recurring,
                    ProductPrice.is_archived.is_(False),
                )
            ),
        )

    @hybrid_property
    def billing_type(self) -> ProductBillingType:
        if self.is_recurring:
            return ProductBillingType.recurring
        return ProductBillingType.one_time

    @billing_type.inplace.expression
    @classmethod
    def _billing_type_expression(cls) -> ColumnElement[ProductBillingType]:
        return case(
            (cls.is_recurring.is_(True), ProductBillingType.recurring),
            else_=ProductBillingType.one_time,
        )


products_search_vector_update_function = PGFunction(
    schema="public",
    signature="products_search_vector_update()",
    definition="""
    RETURNS trigger AS $$
    BEGIN
        NEW.search_vector := to_tsvector('english', coalesce(NEW.name, '') || ' ' || coalesce(NEW.description, ''));
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """,
)

products_search_vector_trigger = PGTrigger(
    schema="public",
    signature="products_search_vector_trigger",
    on_entity="products",
    definition="""
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION products_search_vector_update();
    """,
)

register_entities(
    (
        products_search_vector_update_function,
        products_search_vector_trigger,
    )
)
