import uuid
from collections.abc import Mapping

import structlog

from polar.checkout_link.repository import CheckoutLinkRepository
from polar.discount.repository import DiscountRepository
from polar.enums import SubscriptionProrationBehavior
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import (
    Catalog,
    CatalogMigration,
    CatalogProduct,
    Organization,
    Product,
    ProductCustomField,
    ProductMedia,
    Subscription,
)
from polar.models.catalog import CatalogStatus
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import SubscriptionUpdateContext
from polar.subscription.service import subscription as subscription_service
from polar.worker import enqueue_job

from .repository import (
    CatalogMigrationRepository,
    CatalogProductRepository,
    CatalogRepository,
)

log: Logger = structlog.get_logger()

MIGRATION_BATCH_SIZE = 100


class CatalogService:
    async def lock(self, session: AsyncSession, organization: Organization) -> None:
        await CatalogRepository.from_session(session).lock(organization.id)

    async def get_base_version(
        self, session: AsyncReadSession, organization: Organization
    ) -> tuple[int | None, int]:
        """Return the live version, and the version the next apply builds on."""
        live = await CatalogRepository.from_session(session).get_live(organization.id)
        if live is not None:
            return live.version, live.version
        has_baseline = await ProductRepository.from_session(
            session
        ).has_catalog_baseline(organization.id)
        # Apply creates catalog 1 from the existing products before publishing.
        return (1, 1) if has_baseline else (None, 0)

    async def get_or_create_live(
        self, session: AsyncSession, organization: Organization
    ) -> Catalog | None:
        repository = CatalogRepository.from_session(session)
        live = await repository.get_live(organization.id)
        if live is not None:
            return live

        products = await ProductRepository.from_session(session).get_catalog_baseline(
            organization.id
        )
        if not products:
            return None

        catalog = await repository.create(
            Catalog(
                organization=organization,
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
                    catalog=catalog, product=product, external_id=product.external_id
                )
            )
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

        members = (
            {}
            if live is None
            else {
                member.external_id: member.product
                for member in await catalog_product_repository.get_all_by_catalog(
                    live.id, with_products=True
                )
            }
        )
        if live is not None:
            await repository.update(
                live, update_dict={"status": CatalogStatus.archived}, flush=True
            )
        catalog = await repository.create(
            Catalog(
                organization=organization,
                version=await repository.get_max_version(organization.id) + 1,
                status=CatalogStatus.live,
                published_at=utc_now(),
            ),
            flush=True,
        )
        for external_id, product in new_products.items():
            product.version = catalog.version
            members.pop(external_id, None)
            await catalog_product_repository.create(
                CatalogProduct(
                    catalog=catalog, product=product, external_id=external_id
                )
            )
        for external_id, product in members.items():
            await catalog_product_repository.create(
                CatalogProduct(
                    catalog=catalog, product=product, external_id=external_id
                )
            )
        return catalog

    def copy_product_settings(self, product: Product, new_product: Product) -> None:
        """Copy what config doesn't describe onto a product's new version."""
        new_product.is_archived = product.is_archived
        new_product.is_tax_applicable = product.is_tax_applicable
        new_product.tax_code = product.tax_code
        new_product.product_medias = [
            ProductMedia(file=media.file, order=media.order)
            for media in product.product_medias
        ]
        new_product.attached_custom_fields = [
            ProductCustomField(
                custom_field=field.custom_field,
                order=field.order,
                required=field.required,
            )
            for field in product.attached_custom_fields
        ]

    async def carry_over_references(
        self, session: AsyncSession, replaced: Mapping[uuid.UUID, uuid.UUID]
    ) -> None:
        """Point checkout links and discount restrictions at the new version."""
        checkout_link_repository = CheckoutLinkRepository.from_session(session)
        discount_repository = DiscountRepository.from_session(session)
        for product_id, new_product_id in replaced.items():
            await checkout_link_repository.replace_product(product_id, new_product_id)
            await discount_repository.replace_product(product_id, new_product_id)

    async def get_product_ids(
        self, session: AsyncReadSession, catalog: Catalog
    ) -> dict[str, uuid.UUID]:
        return {
            member.external_id: member.product_id
            for member in await CatalogProductRepository.from_session(
                session
            ).get_all_by_catalog(catalog.id)
        }

    async def get_live_product_ids(
        self, session: AsyncReadSession, organization: Organization
    ) -> dict[str, uuid.UUID]:
        live = await CatalogRepository.from_session(session).get_live(organization.id)
        if live is not None:
            return await self.get_product_ids(session, live)
        products = await ProductRepository.from_session(session).get_catalog_baseline(
            organization.id
        )
        return {
            product.external_id: product.id
            for product in products
            if product.external_id is not None
        }

    async def count_migratable_subscriptions(
        self,
        session: AsyncReadSession,
        organization: Organization,
        source_external_id: str,
        *,
        exclude_product_id: uuid.UUID | None,
    ) -> int:
        repository = SubscriptionRepository.from_session(session)
        return await repository.count(
            repository.get_catalog_migration_statement(
                organization.id,
                source_external_id,
                exclude_product_id=exclude_product_id,
            )
        )

    async def start_migration(
        self,
        session: AsyncSession,
        organization: Organization,
        catalog: Catalog,
        *,
        external_id: str,
        source_external_id: str,
        target_external_id: str,
    ) -> CatalogMigration:
        migration = await CatalogMigrationRepository.from_session(session).create(
            CatalogMigration(
                organization=organization,
                catalog=catalog,
                external_id=external_id,
                source_external_id=source_external_id,
                target_external_id=target_external_id,
            ),
            flush=True,
        )
        enqueue_job("catalog.migrate_subscriptions", migration_id=migration.id)
        return migration

    async def migrate_subscriptions(
        self,
        session: AsyncSession,
        migration_id: uuid.UUID,
        *,
        batch_size: int = MIGRATION_BATCH_SIZE,
    ) -> bool:
        """Move one batch of subscriptions, and return whether more may remain.

        Subscriptions are taken in id order after the last one handled, so a
        subscription rejected by a business rule is skipped once instead of
        retried forever. Any other error aborts the batch, so the task retries it.
        The migration row is locked, so overlapping runs don't process a batch twice.
        """
        repository = CatalogMigrationRepository.from_session(session)
        migration = await repository.get_by_id(migration_id, for_update=True)
        if migration is None or migration.completed_at is not None:
            return False

        target = await CatalogProductRepository.from_session(session).get_product(
            migration.catalog_id, migration.target_external_id
        )
        assert target is not None

        subscription_repository = SubscriptionRepository.from_session(session)
        statement = (
            subscription_repository.get_catalog_migration_statement(
                migration.organization_id,
                migration.source_external_id,
                exclude_product_id=target.id,
                after_id=migration.last_subscription_id,
            )
            .order_by(Subscription.id)
            .limit(batch_size)
            .options(*subscription_repository.get_eager_options())
            .with_for_update(of=Subscription)
        )
        subscriptions = await subscription_repository.get_all(statement)

        migrated = skipped = 0
        for subscription in subscriptions:
            try:
                async with session.begin_nested():
                    async with SubscriptionUpdateContext(
                        session,
                        subscription,
                        subscription_service,
                        notify_customer=False,
                    ) as ctx:
                        await subscription_service.update_product(
                            session,
                            ctx,
                            subscription,
                            product_id=target.id,
                            proration_behavior=SubscriptionProrationBehavior.next_period,
                        )
                migrated += 1
            except PolarError as e:
                log.info(
                    "Subscription skipped by catalog migration",
                    migration_id=migration.id,
                    subscription_id=subscription.id,
                    error=type(e).__name__,
                )
                skipped += 1

        has_more = len(subscriptions) == batch_size
        await repository.update(
            migration,
            update_dict={
                "subscriptions_count": migration.subscriptions_count + migrated,
                "skipped_count": migration.skipped_count + skipped,
                "last_subscription_id": subscriptions[-1].id
                if subscriptions
                else migration.last_subscription_id,
                "completed_at": None if has_more else utc_now(),
            },
        )
        return has_more


catalog = CatalogService()
