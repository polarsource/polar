from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, and_, case, func, select
from sqlalchemy.orm import contains_eager, joinedload, selectinload

from polar.authz.types import AccessibleOrganizationID
from polar.kit.currency import PresentmentCurrency
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import (
    CheckoutProduct,
    Product,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
)
from polar.models.product_price import ProductPriceAmountType, ProductPriceSource
from polar.postgres import sql

from .sorting import ProductSortProperty


class ProductRepository(
    RepositorySortingMixin[Product, ProductSortProperty],
    RepositorySoftDeletionIDMixin[Product, UUID],
    RepositorySoftDeletionMixin[Product],
    RepositoryBase[Product],
):
    model = Product

    async def get_by_id_and_organization(
        self,
        id: UUID,
        organization_id: UUID,
        *,
        options: Options = (),
    ) -> Product | None:
        statement = (
            self.get_base_statement()
            .where(Product.id == id, Product.organization_id == organization_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_id_and_checkout(
        self,
        id: UUID,
        checkout_id: UUID,
        *,
        options: Options = (),
    ) -> Product | None:
        statement = (
            self.get_base_statement()
            .join(CheckoutProduct, onclause=Product.id == CheckoutProduct.product_id)
            .where(
                Product.id == id,
                CheckoutProduct.checkout_id == checkout_id,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_eager_options(self) -> Options:
        return (
            joinedload(Product.organization),
            selectinload(Product.product_medias),
            selectinload(Product.attached_custom_fields),
            selectinload(Product.all_prices),
        )

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[Product]]:
        statement = self.get_base_statement()
        statement = statement.where(Product.organization_id.in_(org_ids))
        return statement

    async def count_by_organization_id(
        self,
        organization_id: UUID,
        *,
        is_archived: bool | None = None,
    ) -> int:
        """Count products for an organization with optional archived filter."""
        statement = sql.select(sql.func.count(Product.id)).where(
            Product.organization_id == organization_id,
            Product.is_deleted.is_(False),
        )

        if is_archived is not None:
            statement = statement.where(Product.is_archived.is_(is_archived))

        count = await self.session.scalar(statement)
        return count or 0

    def get_sorting_clause(self, property: ProductSortProperty) -> SortingClause:
        match property:
            case ProductSortProperty.created_at:
                return Product.created_at
            case ProductSortProperty.product_name:
                return Product.name
            case ProductSortProperty.price_amount_type:
                return case(
                    (
                        ProductPrice.amount_type == ProductPriceAmountType.free,
                        1,
                    ),
                    (
                        ProductPrice.amount_type == ProductPriceAmountType.custom,
                        2,
                    ),
                    (
                        ProductPrice.amount_type == ProductPriceAmountType.fixed,
                        3,
                    ),
                )
            case ProductSortProperty.price_amount:
                return case(
                    (
                        ProductPrice.amount_type == ProductPriceAmountType.free,
                        -2,
                    ),
                    (
                        ProductPrice.amount_type == ProductPriceAmountType.custom,
                        func.coalesce(ProductPriceCustom.minimum_amount, -1),
                    ),
                    (
                        ProductPrice.amount_type == ProductPriceAmountType.fixed,
                        ProductPriceFixed.price_amount,
                    ),
                )

    async def get_products_without_currency(
        self, organization_id: UUID, currency: PresentmentCurrency
    ) -> Sequence[Product]:
        """Get active products that don't have the specified currency in their prices."""
        statement = (
            select(Product)
            .join(
                ProductPrice,
                and_(
                    ProductPrice.product_id == Product.id,
                    ProductPrice.is_archived.is_(False),
                    ProductPrice.price_currency == currency,
                    ProductPrice.source == ProductPriceSource.catalog,
                ),
                isouter=True,
            )
            .where(
                Product.organization_id == organization_id,
                Product.is_archived.is_(False),
                ProductPrice.id.is_(None),
            )
        )

        return await self.get_all(statement)


class ProductPriceRepository(
    RepositorySoftDeletionIDMixin[ProductPrice, UUID],
    RepositorySoftDeletionMixin[ProductPrice],
    RepositoryBase[ProductPrice],
):
    model = ProductPrice

    async def get_readable_by_id(
        self,
        id: UUID,
        org_ids: set[AccessibleOrganizationID],
        *,
        options: Options = (),
    ) -> ProductPrice | None:
        statement = (
            self.get_statement_by_org_ids(org_ids)
            .where(ProductPrice.id == id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_by_stripe_price_id(
        self, stripe_price_id: str, *, options: Options = ()
    ) -> ProductPrice | None:
        statement = (
            self.get_base_statement()
            .where(ProductPrice.__table__.c["stripe_price_id"] == stripe_price_id)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    def get_eager_options(self) -> Options:
        return (joinedload(ProductPrice.product),)

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[tuple[ProductPrice]]:
        return (
            self.get_base_statement()
            .join(Product, Product.id == ProductPrice.product_id)
            .options(contains_eager(ProductPrice.product))
            .where(Product.organization_id.in_(org_ids))
        )
