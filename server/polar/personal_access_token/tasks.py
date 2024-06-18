import uuid
from datetime import datetime

from polar.worker import AsyncSessionMaker, JobContext, PolarWorkerContext, task

from .service import personal_access_token as personal_access_token_service


@task("personal_access_token.record_usage")
async def record_usage(
    ctx: JobContext,
    personal_access_token_id: uuid.UUID,
    last_used_at: datetime,
    polar_context: PolarWorkerContext,
) -> None:
    async with AsyncSessionMaker(ctx) as session:
        await personal_access_token_service.record_usage(
            session, personal_access_token_id, last_used_at
        )
