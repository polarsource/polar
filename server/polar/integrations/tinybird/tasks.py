from datetime import timedelta

from apscheduler.triggers.cron import CronTrigger

from polar.kit.utils import utc_now
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import reconcile_events


@actor(
    actor_name="tinybird.reconcile_events",
    cron_trigger=CronTrigger(minute=0),
    priority=TaskPriority.LOW,
)
async def reconcile_events_task() -> None:
    async with AsyncSessionMaker() as session:
        end = utc_now() - timedelta(minutes=5)
        start = end - timedelta(minutes=60)
        await reconcile_events(session, start, end)
