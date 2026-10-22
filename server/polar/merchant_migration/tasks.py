import asyncio
from typing import Annotated
from uuid import UUID

import structlog

from polar.config import settings
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.observability.task_logging import LoggableField
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    RedisMiddleware,
    TaskPriority,
    actor,
)

from . import pan_transfer, slack
from .repository import MerchantMigrationRepository
from .service import merchant_migration as merchant_migration_service

log: Logger = structlog.get_logger()


@actor(
    actor_name="merchant_migration.precheck",
    priority=TaskPriority.LOW,
    time_limit=600_000,
)
async def merchant_migration_precheck(
    merchant_migration_id: Annotated[UUID, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        await merchant_migration_service.execute_precheck(
            session, merchant_migration_id
        )


@actor(
    actor_name="merchant_migration.import_catalog",
    priority=TaskPriority.LOW,
    time_limit=600_000,
    max_retries=3,
)
async def merchant_migration_import_catalog(
    merchant_migration_id: Annotated[UUID, LoggableField],
) -> None:
    """Create products, discounts, and customers, one batch per run."""
    async with AsyncSessionMaker() as session:
        await merchant_migration_service.execute_import(session, merchant_migration_id)


@actor(
    actor_name="merchant_migration.verify_cards",
    priority=TaskPriority.LOW,
)
async def merchant_migration_verify_cards(
    merchant_migration_id: Annotated[UUID, LoggableField],
    offset: Annotated[int, LoggableField] = 0,
) -> None:
    """Link the moved cards to the imported subscriptions, one batch per run."""
    async with AsyncSessionMaker() as session:
        await merchant_migration_service.run_card_verification(
            session, merchant_migration_id, offset=offset
        )


@actor(
    actor_name="merchant_migration.cutover",
    priority=TaskPriority.LOW,
)
async def merchant_migration_cutover(
    merchant_migration_id: Annotated[UUID, LoggableField],
) -> None:
    """Switch billing over to Polar, one subscription per run.

    Each run is its own transaction because the run cancels a subscription on the
    merchant's provider: work already done must never be replayed by a retry of
    work that came after it.
    """
    async with AsyncSessionMaker() as session:
        await merchant_migration_service.run_cutover(session, merchant_migration_id)


@actor(
    actor_name="merchant_migration.notify_created",
    priority=TaskPriority.LOW,
)
async def merchant_migration_notify_created(
    merchant_migration_id: Annotated[UUID, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        repository = MerchantMigrationRepository.from_session(session)
        migration = await repository.get_ops_by_id(merchant_migration_id)
        if migration is None:
            log.warning(
                "merchant_migration.missing",
                merchant_migration_id=merchant_migration_id,
            )
            return
        await slack.notify_created(RedisMiddleware.get(), migration)


@actor(
    actor_name="merchant_migration.notify_waiting_for_ops",
    priority=TaskPriority.LOW,
)
async def merchant_migration_notify_waiting_for_ops(
    merchant_migration_id: Annotated[UUID, LoggableField],
    step_key: Annotated[str, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        repository = MerchantMigrationRepository.from_session(session)
        migration = await repository.get_ops_by_id(merchant_migration_id)
        if migration is None:
            log.warning(
                "merchant_migration.missing",
                merchant_migration_id=merchant_migration_id,
            )
            return
        step = pan_transfer.current_ops_step(migration.pan_transfer_steps)
        if step is None or step.key != step_key:
            return
        await slack.notify_waiting_for_ops(RedisMiddleware.get(), migration, step)


@actor(
    actor_name="merchant_migration.close_idle",
    cron_trigger=CronTrigger.from_crontab("0 3 * * *"),
    priority=TaskPriority.LOW,
    max_retries=0,
    time_limit=600_000,
)
async def merchant_migration_close_idle() -> None:
    """Close migrations with no activity for the retention period, each in its
    own transaction. One interrupted run is picked up by the next."""
    idle_since = utc_now() - settings.MERCHANT_MIGRATION_IDLE_RETENTION_PERIOD
    async with AsyncSessionMaker() as session:
        repository = MerchantMigrationRepository.from_session(session)
        migration_ids = await repository.list_idle_ids(idle_since)

    closed = 0
    for migration_id in migration_ids:
        async with AsyncSessionMaker() as session:
            if await merchant_migration_service.close_idle(
                session, migration_id, idle_since=idle_since
            ):
                closed += 1
        await asyncio.sleep(0.1)

    log.info(
        "merchant_migration.close_idle",
        candidates=len(migration_ids),
        closed=closed,
    )
