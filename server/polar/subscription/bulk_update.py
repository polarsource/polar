import uuid

import structlog

from polar.auth.models import AuthSubject, User
from polar.enums import SubscriptionProrationBehavior
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Organization, Product, Subscription, SubscriptionBulkUpdate
from polar.postgres import AsyncReadSession, AsyncSession
from polar.product.repository import ProductRepository
from polar.product.service import product as product_service
from polar.worker import enqueue_job

from .repository import SubscriptionBulkUpdateRepository, SubscriptionRepository
from .schemas import SubscriptionBulkUpdateCreate
from .service import SubscriptionUpdateContext
from .service import subscription as subscription_service

log: Logger = structlog.get_logger()

BATCH_SIZE = 100


class SubscriptionBulkUpdateService:
    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> SubscriptionBulkUpdate | None:
        repository = SubscriptionBulkUpdateRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            SubscriptionBulkUpdate.id == id
        )
        return await repository.get_one_or_none(statement)

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        bulk_update_create: SubscriptionBulkUpdateCreate,
    ) -> SubscriptionBulkUpdate:
        target = await product_service.get_move_target(
            session, auth_subject, bulk_update_create.target_product_id
        )
        return await self.start(
            session,
            target.organization,
            source_external_id=bulk_update_create.product_external_id,
            target_product=target,
        )

    async def start(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        source_external_id: str,
        target_product: Product,
    ) -> SubscriptionBulkUpdate:
        """Start moving subscriptions at their next renewal.

        Only `next_period` is supported: an immediate change charges the customer
        inside the batch, and a retried batch would charge them again.
        """
        bulk_update = await SubscriptionBulkUpdateRepository.from_session(
            session
        ).create(
            SubscriptionBulkUpdate(
                organization=organization,
                source_external_id=source_external_id,
                target_product=target_product,
                proration_behavior=SubscriptionProrationBehavior.next_period,
            ),
            flush=True,
        )
        enqueue_job("subscription.bulk_update", bulk_update_id=bulk_update.id)
        return bulk_update

    async def run_batch(
        self,
        session: AsyncSession,
        bulk_update_id: uuid.UUID,
        *,
        batch_size: int = BATCH_SIZE,
    ) -> bool:
        """Move one batch of subscriptions, and return whether more may remain.

        Subscriptions are taken in id order after the last one handled, so a
        subscription rejected by a business rule is skipped once instead of
        retried forever. Any other error aborts the batch, so the task retries it.
        The bulk update row is locked, so overlapping runs don't process a batch
        twice.
        """
        repository = SubscriptionBulkUpdateRepository.from_session(session)
        bulk_update = await repository.get_by_id(bulk_update_id, for_update=True)
        if bulk_update is None or bulk_update.completed_at is not None:
            return False

        target = await ProductRepository.from_session(session).get_by_id(
            bulk_update.target_product_id
        )
        # The target was deleted after the bulk update started: nothing can move
        # anymore, so end it instead of failing every retry.
        if target is None:
            log.warning(
                "Subscription bulk update target no longer exists",
                bulk_update_id=bulk_update.id,
            )
            await repository.update(
                bulk_update, update_dict={"completed_at": utc_now()}
            )
            return False

        subscription_repository = SubscriptionRepository.from_session(session)
        statement = (
            subscription_repository.get_bulk_update_statement(
                bulk_update.organization_id,
                bulk_update.source_external_id,
                exclude_product_id=target.id,
                after_id=bulk_update.last_subscription_id,
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
                            proration_behavior=bulk_update.proration_behavior,
                        )
                moved += 1
            except PolarError as e:
                if e.status_code >= 500:
                    raise
                log.info(
                    "Subscription skipped by bulk update",
                    bulk_update_id=bulk_update.id,
                    subscription_id=subscription.id,
                    error=type(e).__name__,
                )
                skipped += 1

        has_more = len(subscriptions) == batch_size
        await repository.update(
            bulk_update,
            update_dict={
                "subscriptions_count": bulk_update.subscriptions_count + moved,
                "skipped_count": bulk_update.skipped_count + skipped,
                "last_subscription_id": subscriptions[-1].id
                if subscriptions
                else bulk_update.last_subscription_id,
                "completed_at": None if has_more else utc_now(),
            },
        )
        return has_more


subscription_bulk_update = SubscriptionBulkUpdateService()
