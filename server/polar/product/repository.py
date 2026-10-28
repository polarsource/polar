from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, and_, case, func, select, union
from sqlalchemy.orm import contains_eager, joinedload, selectinload, undefer

from polar.authz.types import AccessibleOrganizationID
from polar.kit.currency import PresentmentCurrency
from polar.kit.db.locking import pg_advisory_xact_lock
from polar.kit.metadata import get_metadata_clause
from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositoryExternalIDMixin,
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
    Subscription,
    SubscriptionUpdate,
)
from polar.models.product_price import ProductPriceAmountType, ProductPriceSource
from polar.postgres import sql

from .sorting import ProductSortProperty


class ProductRepository(
    RepositoryExternalIDMixin[Product],
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

    async def get_by_external_id_and_organization(
        self, external_id: str, organization_id: UUID
    ) -> Product | None:
        statement = self.get_base_statement().where(
            Product.external_id == external_id,
            Product.organization_id == organization_id,
            Product.is_current,
        )
        return await self.get_one_or_none(statement)

    def get_catalog_baseline_statement(
        self, organization_id: UUID
    ) -> Select[tuple[Product]]:
        return self.get_base_statement().where(
            Product.organization_id == organization_id,
            Product.external_id.is_not(None),
            Product.is_current,
            ~Product.is_archived,
        )

    async def get_catalog_baseline(self, organization_id: UUID) -> Sequence[Product]:
        statement = self.get_catalog_baseline_statement(organization_id).options(
            undefer(Product.external_id)
        )
        return await self.get_all(statement)

    async def get_all_by_external_ids(
        self,
        organization_id: UUID,
        external_ids: Sequence[str],
        *,
        for_update: bool = False,
    ) -> Sequence[Product]:
        statement = (
            self.get_base_statement()
            .where(
                Product.organization_id == organization_id,
                Product.external_id.in_(external_ids),
                Product.is_current,
            )
            .options(undefer(Product.external_id), *self.get_eager_options())
        )
        if for_update:
            statement = statement.with_for_update(of=Product, key_share=True)
        return await self.get_all(statement)

    async def get_external_ids_in_use(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> set[str]:
        """Return the external IDs that a billable subscription is on, or is
        scheduled to change to, in any of their versions."""
        if not external_ids:
            return set()
        products = (
            Product.organization_id == organization_id,
            Product.external_id.in_(external_ids),
        )
        subscribed = (
            select(Product.external_id)
            .join(Subscription, Subscription.product_id == Product.id)
            .where(*products, Subscription.billable, ~Subscription.is_deleted)
        )
        scheduled = (
            select(Product.external_id)
            .join(SubscriptionUpdate, SubscriptionUpdate.product_id == Product.id)
            .join(Subscription, Subscription.id == SubscriptionUpdate.subscription_id)
            .where(
                *products,
                SubscriptionUpdate.applied_at.is_(None),
                ~SubscriptionUpdate.is_deleted,
                Subscription.billable,
                ~Subscription.is_deleted,
            )
        )
        result = await self.session.execute(union(subscribed, scheduled))
        return {external_id for external_id in result.scalars() if external_id}

    def get_organization_statement(
        self, organization_id: UUID
    ) -> Select[tuple[Product]]:
        return (
            self.get_base_statement()
            .where(
                Product.organization_id == organization_id,
                Product.is_current.is_(True),
            )
            .order_by(Product.created_at, Product.id)
        )

    async def lock_metadata_reference(self, key: str, value: str) -> None:
        """Serialize writers finding or creating a product by this metadata."""
        await pg_advisory_xact_lock(self.session, f"product.metadata.{key}", value)

    async def get_by_organization_and_metadata(
        self,
        organization_id: UUID,
        key: str,
        value: str,
        *,
        options: Options = (),
    ) -> Product | None:
        """The oldest product whose metadata maps ``key`` to ``value``."""
        statement = (
            self.get_base_statement()
            .where(
                Product.organization_id == organization_id,
                get_metadata_clause(Product, {key: [value]}),
            )
            .order_by(Product.created_at, Product.id)
            .limit(1)
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_price_currencies(self, organization_id: UUID) -> set[str]:
        """Distinct currencies the organization's active prices are set in."""
        statement = (
            select(ProductPrice.price_currency)
            .join(Product, Product.id == ProductPrice.product_id)
            .where(
                Product.organization_id == organization_id,
                ~Product.is_archived,
                ~ProductPrice.is_archived,
                ProductPrice.price_currency.is_not(None),
            )
            .distinct()
        )
        result = await self.session.execute(statement)
        return {row[0].lower() for row in result.all()}

    async def get_active_names_by_organization(self, organization_id: UUID) -> set[str]:
        """Lower-cased names of the org's active products, used to warn when a
        migration source product would duplicate one that already exists."""
        statement = select(func.lower(Product.name)).where(
            Product.organization_id == organization_id,
            ~Product.is_archived,
            Product.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return {row[0] for row in result.all()}

    async def get_all_by_organization(
        self,
        organization_id: UUID,
        *,
        options: Options = (),
        limit: int | None = None,
    ) -> Sequence[Product]:
        statement = (
            self.get_base_statement()
            .where(
                Product.organization_id == organization_id,
                ~Product.is_archived,
            )
            .order_by(Product.created_at.asc())
            .options(*options)
        )
        if limit is not None:
            statement = statement.limit(limit)
        return await self.get_all(statement)

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
            ~Product.is_deleted,
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
                        ProductPrice.amount_type == ProductPriceAmountType.custom,
                        1,
                    ),
                    (
                        ProductPrice.amount_type == ProductPriceAmountType.fixed,
                        2,
                    ),
                )
            case ProductSortProperty.price_amount:
                return case(
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
                    ~ProductPrice.is_archived,
                    ProductPrice.price_currency == currency,
                    ProductPrice.source == ProductPriceSource.catalog,
                ),
                isouter=True,
            )
            .where(
                Product.organization_id == organization_id,
                Product.is_current,
                ~Product.is_archived,
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
