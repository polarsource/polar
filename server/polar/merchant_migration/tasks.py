from uuid import UUID

from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import merchant_migration as merchant_migration_service


@actor(actor_name="merchant_migration.precheck", priority=TaskPriority.LOW)
async def merchant_migration_precheck(migration_id: UUID) -> None:
    async with AsyncSessionMaker() as session:
        await merchant_migration_service.execute_precheck(session, migration_id)
