from datetime import timedelta

from apscheduler.triggers.cron import CronTrigger

from polar.kit.utils import utc_now
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import ExternalEventRepository


@actor(
    actor_name="external_event.prune",
    priority=TaskPriority.LOW,
    cron_trigger=CronTrigger(hour=0, minute=0),
    max_retries=0,
)
async def external_event_prune() -> None:
    async with AsyncSessionMaker() as session:
        repository = ExternalEventRepository.from_session(session)
        await repository.delete_before(utc_now() - timedelta(days=30))
