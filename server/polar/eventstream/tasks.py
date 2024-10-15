import structlog

from polar.logging import Logger
from polar.worker import JobContext, PolarWorkerContext, get_worker_redis, task

from .service import send_event

log: Logger = structlog.get_logger()


@task("eventstream.publish")
async def eventstream_publish(
    ctx: JobContext,
    event: str,
    channels: list[str],
    polar_context: PolarWorkerContext,
) -> None:
    await send_event(get_worker_redis(ctx), event, channels)
