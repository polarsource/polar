import asyncio
import uuid
from datetime import datetime

from temporalio import activity
from temporalio.client import Client
from temporalio.exceptions import ApplicationError

from polar.config import settings
from polar.kit.db.postgres import AsyncSessionMaker
from polar.void.temporal import TASK_QUEUE
from polar.void.tinybird import TinybirdApi

from .repository import ReducerRepository
from .service import reducer as reducer_service
from .workflows import DerivedReducerWorkflow, RecomputeBucketInput


class ReducerActivities:
    def __init__(
        self,
        sessionmaker: AsyncSessionMaker,
        tinybird: TinybirdApi,
        temporal: Client | None = None,
    ) -> None:
        self.sessionmaker = sessionmaker
        self.tinybird = tinybird
        self.temporal = temporal

    @activity.defn
    async def list_reducers(self, organization_id: str) -> list[str]:
        if (
            not settings.VOID_ENABLED
            or uuid.UUID(organization_id) not in settings.VOID_ORGANIZATION_IDS
        ):
            raise ApplicationError(
                "Void processing is paused for this organization",
                type="VoidOrganizationPaused",
            )
        async with self.sessionmaker() as session:
            repository = ReducerRepository.from_session(session)
            await repository.lock_definitions(uuid.UUID(organization_id), shared=True)
            ids = await repository.event_reducer_ids(uuid.UUID(organization_id))
            return [str(id) for id in ids]

    @activity.defn
    async def recompute_bucket(self, input: RecomputeBucketInput) -> int:
        if (
            not settings.VOID_ENABLED
            or uuid.UUID(input.organization_id) not in settings.VOID_ORGANIZATION_IDS
        ):
            raise ApplicationError(
                "Void processing is paused for this organization",
                type="VoidOrganizationPaused",
            )
        if settings.VOID_REDUCER_PROCESSING_DELAY_SECONDS:
            await asyncio.sleep(settings.VOID_REDUCER_PROCESSING_DELAY_SECONDS)
        async with self.sessionmaker() as session:
            count = await reducer_service.recompute_bucket(
                session,
                self.tinybird,
                uuid.UUID(input.reducer_id),
                datetime.fromisoformat(input.bucket_start),
                uuid.UUID(input.organization_id),
            )
            await session.commit()
            return count

    @activity.defn
    async def dispatch_derived(self) -> int:
        if not settings.VOID_ENABLED or not settings.VOID_ORGANIZATION_IDS:
            return 0
        assert self.temporal is not None
        async with self.sessionmaker() as session:
            jobs = await ReducerRepository.from_session(session).pending_jobs(
                settings.VOID_ORGANIZATION_IDS
            )
            # Keep locks until delivery and deletion commit. A crash replays
            # notifications; a concurrent source update leaves another job.
            for job in jobs:
                start = job.bucket_start.isoformat()
                await self.temporal.start_workflow(
                    DerivedReducerWorkflow.run,
                    RecomputeBucketInput(
                        str(job.reducer_id), str(job.organization_id), start
                    ),
                    id=f"polar-void-derived-reducer-{job.reducer_id}-{start}",
                    task_queue=TASK_QUEUE,
                    start_signal="touch",
                )
                await session.delete(job)
            await session.commit()
            return len(jobs)
