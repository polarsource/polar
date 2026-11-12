from collections.abc import Sequence
from typing import cast
from uuid import UUID

from sqlalchemy import Select, and_, case, func, or_, select, union
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
    Catalog,
    CatalogProduct,
    CheckoutProduct,
    Product,
    ProductBenefit,
    ProductPrice,
    ProductPriceCustom,
    ProductPriceFixed,
    Subscription,
    SubscriptionUpdate,
)
from polar.models.catalog import CatalogStatus
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

    def get_catalog_baseline_statement(self, organization_id: UUID) -> Select[Product]:
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

    async def get_current_by_benefits(
        self, organization_id: UUID, benefit_ids: Sequence[UUID]
    ) -> Sequence[Product]:
        statement = (
            self.get_base_statement()
            .join(ProductBenefit, ProductBenefit.product_id == Product.id)
            .where(
                Product.organization_id == organization_id,
                ProductBenefit.benefit_id.in_(benefit_ids),
                Product.is_current,
                ~Product.is_archived,
            )
            .options(undefer(Product.external_id))
        )
        return await self.get_all(statement)

    async def get_current_by_meters(
        self, organization_id: UUID, meter_ids: Sequence[UUID]
    ) -> Sequence[tuple[Product, UUID]]:
        """Current products with a metered price on one of the meters, with
        that meter."""
        # The subclass attribute would add a polymorphic filter and drop tiered prices.
        meter_id = ProductPrice.__table__.c.meter_id
        statement = (
            select(Product, meter_id)
            .join(ProductPrice, ProductPrice.product_id == Product.id)
            .where(
                Product.organization_id == organization_id,
                Product.is_current,
                ~Product.is_archived,
                Product.deleted_at.is_(None),
                ProductPrice.is_metered,
                ~ProductPrice.is_archived,
                ~ProductPrice.is_deleted,
                meter_id.in_(meter_ids),
            )
            .options(undefer(Product.external_id))
        )
        result = await self.session.execute(statement)
        return list(dict.fromkeys((product, id) for product, id in result.tuples()))

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

    async def get_retired_by_external_ids(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> Sequence[Product]:
        """The latest published version of each product that is no longer current."""
        if not external_ids:
            return []
        drafts = select(Catalog.id).where(
            Catalog.organization_id == organization_id,
            Catalog.status == CatalogStatus.draft,
        )
        statement = (
            self.get_base_statement()
            .where(
                Product.organization_id == organization_id,
                Product.external_id.in_(external_ids),
                Product.is_current.is_(False),
                or_(Product.catalog_id.is_(None), Product.catalog_id.not_in(drafts)),
            )
            .distinct(Product.external_id)
            .order_by(Product.external_id, Product.created_at.desc(), Product.id.desc())
            .options(undefer(Product.external_id), *self.get_eager_options())
        )
        return await self.get_all(statement)

    async def get_version_ids_by_external_ids(
        self,
        organization_ids: Sequence[UUID],
        external_ids: Sequence[str],
    ) -> list[UUID]:
        statement = select(Product.id).where(
            Product.organization_id.in_(organization_ids),
            Product.external_id.in_(external_ids),
        )
        return list(await self.session.scalars(statement))

    async def get_external_ids_in_use(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> set[str]:
        return set(
            await self.count_customers_by_external_ids(organization_id, external_ids)
        )

    async def count_customers_by_external_ids(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> dict[str, int]:
        """Count the customers with a billable subscription on, or scheduled to
        change to, any version of each external ID."""
        if not external_ids:
            return {}
        products = (
            Product.organization_id == organization_id,
            Product.external_id.in_(external_ids),
        )
        subscribed = (
            select(Product.external_id, Subscription.customer_id)
            .join(Subscription, Subscription.product_id == Product.id)
            .where(*products, Subscription.billable, ~Subscription.is_deleted)
        )
        scheduled = (
            select(Product.external_id, Subscription.customer_id)
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
        # The union keeps each (external ID, customer) pair once
        customers = union(subscribed, scheduled).subquery()
        statement = select(customers.c.external_id, func.count()).group_by(
            customers.c.external_id
        )
        result = await self.session.execute(statement)
        return {cast(str, external_id): count for external_id, count in result.tuples()}

    async def get_external_ids(
        self, organization_id: UUID, *, current: bool = False
    ) -> set[str]:
        statement = select(Product.external_id).where(
            Product.organization_id == organization_id,
            Product.external_id.is_not(None),
            ~Product.is_deleted,
        )
        if current:
            statement = statement.where(Product.is_current)
        result = await self.session.execute(statement.distinct())
        return set(cast(Sequence[str], result.scalars().all()))

    def get_latest_by_external_ids_statement(
        self, organization_id: UUID, external_ids: Sequence[str]
    ) -> Select[Product]:
        """Select the most recent version of each product, current or not."""
        return (
            self.get_base_statement()
            .where(
                Product.organization_id == organization_id,
                Product.external_id.in_(external_ids),
            )
            .distinct(Product.external_id)
            .order_by(Product.external_id, Product.created_at.desc(), Product.id.desc())
            .options(undefer(Product.external_id))
        )

    def get_organization_statement(self, organization_id: UUID) -> Select[Product]:
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

    def apply_catalog_filter(
        self,
        statement: Select[Product],
        org_ids: set[AccessibleOrganizationID],
        catalog_id: Sequence[UUID] | None,
        catalog_status: Sequence[CatalogStatus] | None,
    ) -> Select[Product]:
        catalog_members = (
            select(CatalogProduct.product_id)
            .join(CatalogProduct.catalog)
            .where(
                Catalog.organization_id.in_(org_ids),
                CatalogProduct.deleted_at.is_(None),
                Catalog.deleted_at.is_(None),
            )
        )
        if catalog_id is not None:
            statement = statement.where(
                Product.id.in_(catalog_members.where(Catalog.id.in_(catalog_id)))
            )
        if catalog_status is not None:
            in_status = Product.id.in_(
                catalog_members.where(Catalog.status.in_(catalog_status))
            )
            statement = statement.where(
                or_(Product.is_current, in_status)
                if CatalogStatus.live in catalog_status
                else in_status
            )
        return statement

    def get_statement_by_org_ids(
        self, org_ids: set[AccessibleOrganizationID]
    ) -> Select[Product]:
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
    ) -> Select[ProductPrice]:
        return (
            self.get_base_statement()
            .join(Product, Product.id == ProductPrice.product_id)
            .options(contains_eager(ProductPrice.product))
            .where(Product.organization_id.in_(org_ids))
        )
