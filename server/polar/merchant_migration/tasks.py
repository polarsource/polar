from typing import Annotated
from uuid import UUID

from polar.observability.task_logging import LoggableField
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import merchant_migration as merchant_migration_service


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
