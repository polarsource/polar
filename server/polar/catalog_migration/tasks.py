import uuid
from typing import Annotated

from polar.observability.task_logging import LoggableField
from polar.worker import AsyncSessionMaker, TaskPriority, actor, enqueue_job

from .service import catalog_migration as catalog_migration_service


@actor(actor_name="catalog_migration.run", priority=TaskPriority.LOW)
async def catalog_migration_run(
    catalog_migration_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        has_more = await catalog_migration_service.run_batch(
            session, catalog_migration_id
        )

    if has_more:
        enqueue_job("catalog_migration.run", catalog_migration_id=catalog_migration_id)
