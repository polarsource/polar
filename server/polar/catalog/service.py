from collections.abc import Mapping, Sequence
from uuid import UUID

from sqlalchemy import Select, func, select

from polar.enums import SubscriptionProrationBehavior
from polar.kit.db.locking import pg_advisory_xact_lock
from polar.kit.utils import utc_now
from polar.models import (
    Catalog,
    CatalogProduct,
    Organization,
    Product,
    Subscription,
)
from polar.models.catalog import CatalogStatus
from polar.postgres import AsyncReadSession, AsyncSession
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import SubscriptionUpdateContext
from polar.subscription.service import subscription as subscription_service

from .repository import CatalogProductRepository, CatalogRepository


class CatalogService:
    async def lock(self, session: AsyncSession, organization: Organization) -> None:
        await pg_advisory_xact_lock(session, "catalog", organization.id)

    def _baseline_statement(self, organization: Organization) -> Select[tuple[Product]]:
        return select(Product).where(
            Product.organization_id == organization.id,
            Product.external_id.is_not(None),
            Product.is_current,
            Product.deleted_at.is_(None),
            Product.is_archived.is_(False),
        )

    async def get_base_version(
        self, session: AsyncReadSession, organization: Organization
    ) -> tuple[int | None, int]:
        """Return the live version, and the version the next apply builds on."""
        live = await CatalogRepository.from_session(session).get_live(organization.id)
        if live is not None:
            return live.version, live.version
        statement = self._baseline_statement(organization).limit(1)
        has_baseline = (await session.execute(statement)).first() is not None
        return None, 1 if has_baseline else 0

    async def get_or_create_live(
        self, session: AsyncSession, organization: Organization
    ) -> Catalog | None:
        repository = CatalogRepository.from_session(session)
        live = await repository.get_live(organization.id)
        if live is not None:
            return live

        products = (
            (await session.execute(self._baseline_statement(organization)))
            .scalars()
            .all()
        )
        if not products:
            return None

        catalog = await repository.create(
            Catalog(
                organization_id=organization.id,
                version=await repository.get_max_version(organization.id) + 1,
                status=CatalogStatus.live,
                published_at=utc_now(),
            ),
            flush=True,
        )
        catalog_product_repository = CatalogProductRepository.from_session(session)
        for product in products:
            assert product.external_id is not None
            if product.version is None:
                product.version = catalog.version
            await catalog_product_repository.create(
                CatalogProduct(
                    catalog_id=catalog.id,
                    product_id=product.id,
                    external_id=product.external_id,
                )
            )
        await session.flush()
        return catalog

    async def publish(
        self,
        session: AsyncSession,
        organization: Organization,
        live: Catalog | None,
        new_products: Mapping[str, Product],
    ) -> Catalog:
        repository = CatalogRepository.from_session(session)
        catalog_product_repository = CatalogProductRepository.from_session(session)

        catalog = await repository.create(
            Catalog(
                organization_id=organization.id,
                version=await repository.get_max_version(organization.id) + 1,
                status=CatalogStatus.draft,
            ),
            flush=True,
        )
        members = {} if live is None else await self.get_product_ids(session, live)
        for external_id, product in new_products.items():
            product.version = catalog.version
            members[external_id] = product.id
        for external_id, product_id in members.items():
            await catalog_product_repository.create(
                CatalogProduct(
                    catalog_id=catalog.id,
                    product_id=product_id,
                    external_id=external_id,
                )
            )

        if live is not None:
            await repository.update(
                live, update_dict={"status": CatalogStatus.archived}, flush=True
            )
        await repository.update(
            catalog,
            update_dict={"status": CatalogStatus.live, "published_at": utc_now()},
            flush=True,
        )
        return catalog

    async def get_product_ids(
        self, session: AsyncReadSession, catalog: Catalog
    ) -> dict[str, UUID]:
        return {
            member.external_id: member.product_id
            for member in await CatalogProductRepository.from_session(
                session
            ).get_all_by_catalog(catalog.id)
        }

    async def get_live_product_ids(
        self, session: AsyncReadSession, organization: Organization
    ) -> dict[str, UUID]:
        live = await CatalogRepository.from_session(session).get_live(organization.id)
        if live is not None:
            return await self.get_product_ids(session, live)
        products = (
            (await session.execute(self._baseline_statement(organization)))
            .scalars()
            .all()
        )
        return {
            product.external_id: product.id
            for product in products
            if product.external_id is not None
        }

    async def get_catalog_product(
        self, session: AsyncReadSession, catalog: Catalog, external_id: str
    ) -> Product | None:
        return await CatalogProductRepository.from_session(session).get_product(
            catalog.id, external_id
        )

    async def get_migratable_subscriptions(
        self,
        session: AsyncReadSession,
        organization: Organization,
        source_external_id: str,
        target: Product,
    ) -> Sequence[Subscription]:
        repository = SubscriptionRepository.from_session(session)
        statement = (
            repository.get_base_statement()
            .join(Product, Product.id == Subscription.product_id)
            .where(
                Product.organization_id == organization.id,
                Product.external_id == source_external_id,
                Subscription.product_id != target.id,
                Subscription.active,
            )
            .order_by(Subscription.created_at.asc())
            .options(*repository.get_eager_options())
        )
        return await repository.get_all(statement)

    async def count_migratable_subscriptions(
        self,
        session: AsyncReadSession,
        organization: Organization,
        source_external_id: str,
        *,
        exclude_product_id: UUID | None,
    ) -> int:
        statement = (
            select(func.count(Subscription.id))
            .join(Product, Product.id == Subscription.product_id)
            .where(
                Product.organization_id == organization.id,
                Product.external_id == source_external_id,
                Subscription.active,
                Subscription.deleted_at.is_(None),
            )
        )
        if exclude_product_id is not None:
            statement = statement.where(Subscription.product_id != exclude_product_id)
        return (await session.execute(statement)).scalar_one()

    async def migrate_subscriptions(
        self,
        session: AsyncSession,
        organization: Organization,
        source_external_id: str,
        target: Product,
    ) -> int:
        migrated = 0
        for subscription in await self.get_migratable_subscriptions(
            session, organization, source_external_id, target
        ):
            # Manual changes take priority over migrations.
            if subscription.pending_update is not None:
                continue
            async with SubscriptionUpdateContext(
                session, subscription, subscription_service, notify_customer=False
            ) as ctx:
                await subscription_service.update_product(
                    session,
                    ctx,
                    subscription,
                    product_id=target.id,
                    proration_behavior=SubscriptionProrationBehavior.next_period,
                )
            migrated += 1
        return migrated


catalog = CatalogService()
