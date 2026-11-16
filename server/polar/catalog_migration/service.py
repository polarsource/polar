import uuid
from collections.abc import Sequence
from typing import Any

import structlog

from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_resource_permission
from polar.enums import SubscriptionProrationBehavior
from polar.exceptions import (
    NotPermitted,
    PolarError,
    PolarRequestValidationError,
    ValidationError,
)
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import CatalogMigration, Product, Subscription
from polar.models.catalog_migration import CatalogMigrationStatus
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository
from polar.product.service import product as product_service
from polar.subscription.repository import SubscriptionRepository
from polar.subscription.service import SubscriptionUpdateContext
from polar.subscription.service import subscription as subscription_service
from polar.worker import enqueue_job

from .repository import CatalogMigrationRepository
from .schemas import CatalogMigrationCreate

log: Logger = structlog.get_logger()

BATCH_SIZE = 100


class CatalogMigrationService:
    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> CatalogMigration | None:
        repository = CatalogMigrationRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            CatalogMigration.id == id
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        catalog_migration_create: CatalogMigrationCreate,
    ) -> CatalogMigration:
        target = await self._get_target(
            session, auth_subject, catalog_migration_create.target_product_id
        )
        await self._validate_sources(
            session, target, catalog_migration_create.source_product_ids
        )
        catalog_migration = await CatalogMigrationRepository.from_session(
            session
        ).create(
            CatalogMigration(
                organization=target.organization,
                source_product_ids=catalog_migration_create.source_product_ids,
                target_product=target,
            ),
            flush=True,
        )
        enqueue_job("catalog_migration.run", catalog_migration_id=catalog_migration.id)
        return catalog_migration

    async def run_batch(
        self,
        session: AsyncSession,
        catalog_migration_id: uuid.UUID,
        *,
        batch_size: int = BATCH_SIZE,
    ) -> bool:
        """Schedule one batch of subscriptions to move at their next renewal, and
        return whether more may remain.

        Only `next_period` is used: an immediate change charges the customer
        inside the batch, and a retried batch would charge them again.

        Subscriptions are taken in id order after the last one handled, so a
        subscription rejected by a business rule is skipped once instead of
        retried forever. Any other error aborts the batch, so the task retries it.
        The catalog migration row is locked, so overlapping runs don't process a
        batch twice.
        """
        repository = CatalogMigrationRepository.from_session(session)
        catalog_migration = await repository.get_by_id(
            catalog_migration_id, for_update=True
        )
        if (
            catalog_migration is None
            or catalog_migration.status == CatalogMigrationStatus.completed
        ):
            return False

        target = await ProductRepository.from_session(session).get_by_id(
            catalog_migration.target_product_id
        )
        # Customers only move to the current version. A target replaced or deleted
        # since the migration started ends it instead of failing every retry.
        if target is None or not target.is_current or target.is_archived:
            log.warning(
                "Catalog migration target is no longer the current version",
                catalog_migration_id=catalog_migration.id,
            )
            await repository.update(
                catalog_migration,
                update_dict={
                    "status": CatalogMigrationStatus.completed,
                    "completed_at": utc_now(),
                },
            )
            return False

        subscription_repository = SubscriptionRepository.from_session(session)
        statement = (
            subscription_repository.get_catalog_migration_statement(
                catalog_migration.source_product_ids,
                after_id=catalog_migration.last_processed_id,
            )
            .order_by(Subscription.id)
            .limit(batch_size)
            .options(*subscription_repository.get_eager_options())
            .with_for_update(of=Subscription)
        )
        subscriptions = await subscription_repository.get_all(statement)

        moved = skipped = 0
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
                moved += 1
            except PolarError as e:
                if e.status_code >= 500:
                    raise
                log.info(
                    "Subscription skipped by catalog migration",
                    catalog_migration_id=catalog_migration.id,
                    subscription_id=subscription.id,
                    error=type(e).__name__,
                )
                skipped += 1

        has_more = len(subscriptions) == batch_size
        update_dict: dict[str, Any] = {
            "moved_count": catalog_migration.moved_count + moved,
            "skipped_count": catalog_migration.skipped_count + skipped,
        }
        if subscriptions:
            update_dict["last_processed_id"] = subscriptions[-1].id
        if not has_more:
            update_dict["status"] = CatalogMigrationStatus.completed
            update_dict["completed_at"] = utc_now()
        await repository.update(catalog_migration, update_dict=update_dict)
        return has_more

    async def _get_target(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        target_product_id: uuid.UUID,
    ) -> Product:
        target = await product_service.get(session, auth_subject, target_product_id)
        if target is None or not target.is_current or target.is_archived:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "target_product_id"),
                        "msg": "Product not found, or not the current version.",
                        "input": target_product_id,
                    }
                ]
            )
        await assert_resource_permission(
            session, auth_subject, target, OrganizationPermission.sales_manage
        )
        if not target.organization.is_config_as_code_enabled:
            raise NotPermitted("Config as code isn't enabled for this organization.")
        if not target.is_recurring:
            raise PolarRequestValidationError(
                [
                    {
                        "type": "value_error",
                        "loc": ("body", "target_product_id"),
                        "msg": "Only recurring products can be migrated.",
                        "input": target_product_id,
                    }
                ]
            )
        return target

    async def _validate_sources(
        self,
        session: AsyncSession,
        target: Product,
        source_product_ids: Sequence[uuid.UUID],
    ) -> None:
        versions: set[uuid.UUID] = set()
        if target.external_id is not None:
            versions = set(
                await ProductRepository.from_session(
                    session
                ).get_version_ids_by_external_ids(
                    [target.organization_id], [target.external_id]
                )
            )
        errors: list[ValidationError] = [
            {
                "type": "value_error",
                "loc": ("body", "source_product_ids", index),
                "msg": "Not another version of the target product.",
                "input": source_product_id,
            }
            for index, source_product_id in enumerate(source_product_ids)
            if source_product_id == target.id or source_product_id not in versions
        ]
        if errors:
            raise PolarRequestValidationError(errors)


catalog_migration = CatalogMigrationService()
