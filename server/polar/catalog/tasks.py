import uuid
from typing import Annotated

from polar.observability.task_logging import LoggableField
from polar.worker import AsyncSessionMaker, TaskPriority, actor, enqueue_job

from .service import catalog as catalog_service


@actor(actor_name="catalog.migrate_subscriptions", priority=TaskPriority.LOW)
async def catalog_migrate_subscriptions(
    migration_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        has_more = await catalog_service.migrate_subscriptions(session, migration_id)

    if has_more:
        enqueue_job("catalog.migrate_subscriptions", migration_id=migration_id)
