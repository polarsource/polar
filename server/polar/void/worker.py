import asyncio
from datetime import timedelta

import structlog
from temporalio import activity
from temporalio.client import (
    Client,
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleAlreadyRunningError,
    ScheduleIntervalSpec,
    ScheduleSpec,
)
from temporalio.worker import Worker
from temporalio.worker.workflow_sandbox import (
    SandboxedWorkflowRunner,
    SandboxRestrictions,
)

from polar.config import settings
from polar.kit.db.postgres import AsyncSessionMaker, create_async_sessionmaker
from polar.logging import configure
from polar.postgres import create_async_engine
from polar.void.activity.activities import ActivityActivities
from polar.void.activity.workflows import ActivitySweepWorkflow
from polar.void.event.service import event as event_service
from polar.void.event.workflows import EventDispatchWorkflow
from polar.void.meter.activities import MeterActivities
from polar.void.meter.workflows import MeterCycleWorkflow
from polar.void.organization.repository import OrganizationRepository
from polar.void.reducer.activities import ReducerActivities
from polar.void.reducer.workflows import (
    DerivedDispatchWorkflow,
    DerivedReducerWorkflow,
    ReducerBucketWorkflow,
)
from polar.void.temporal import TASK_QUEUE, connect
from polar.void.tinybird import TinybirdApi, create_client

log = structlog.get_logger()


class EventActivities:
    def __init__(
        self, sessionmaker: AsyncSessionMaker, tinybird: TinybirdApi, temporal: Client
    ) -> None:
        self.sessionmaker = sessionmaker
        self.tinybird = tinybird
        self.temporal = temporal

    @activity.defn
    async def dispatch_events(self) -> int:
        async with self.sessionmaker() as session:
            count = await event_service.deliver_pending(
                session,
                self.tinybird,
                self.temporal,
                await OrganizationRepository.from_session(session).enabled_ids(),
            )
            await session.commit()
            return count


async def ensure_schedules(client: Client) -> None:
    for name, run, interval in (
        ("events", EventDispatchWorkflow.run, timedelta(seconds=1)),
        ("reducers", DerivedDispatchWorkflow.run, timedelta(seconds=1)),
        ("meter-cycles", MeterCycleWorkflow.run, timedelta(minutes=5)),
        ("activities", ActivitySweepWorkflow.run, timedelta(seconds=1)),
    ):
        schedule_id = f"{TASK_QUEUE}-dispatch-{name}"
        try:
            await client.create_schedule(
                schedule_id,
                Schedule(
                    action=ScheduleActionStartWorkflow(
                        run, id=schedule_id, task_queue=TASK_QUEUE
                    ),
                    spec=ScheduleSpec(intervals=[ScheduleIntervalSpec(every=interval)]),
                ),
            )
        except ScheduleAlreadyRunningError:
            pass


def create_worker(
    client: Client, sessionmaker: AsyncSessionMaker, tinybird: TinybirdApi
) -> Worker:
    reducers = ReducerActivities(sessionmaker, tinybird, client)
    events = EventActivities(sessionmaker, tinybird, client)
    meters = MeterActivities(sessionmaker, tinybird)
    activities = ActivityActivities(sessionmaker)
    return Worker(
        client,
        task_queue=TASK_QUEUE,
        workflow_runner=SandboxedWorkflowRunner(
            restrictions=SandboxRestrictions.default.with_passthrough_modules(
                "polar.base"
            )
        ),
        workflows=[
            ReducerBucketWorkflow,
            DerivedReducerWorkflow,
            DerivedDispatchWorkflow,
            EventDispatchWorkflow,
            MeterCycleWorkflow,
            ActivitySweepWorkflow,
        ],
        activities=[
            reducers.list_reducers,
            reducers.recompute_bucket,
            reducers.dispatch_derived,
            events.dispatch_events,
            meters.cycle_meters,
            activities.classify_due_spans,
        ],
        max_concurrent_activities=settings.DATABASE_POOL_SIZE,
    )


async def main() -> None:
    tinybird = create_client()
    engine = create_async_engine("worker", pool_logging_name="void_worker")
    try:
        client = await connect()
        sessionmaker = create_async_sessionmaker(engine)
        worker = create_worker(client, sessionmaker, tinybird)
        await ensure_schedules(client)
        log.info("Starting Void worker", task_queue=TASK_QUEUE)
        await worker.run()
    finally:
        tinybird.close()
        await engine.dispose()


if __name__ == "__main__":
    configure()
    asyncio.run(main())
