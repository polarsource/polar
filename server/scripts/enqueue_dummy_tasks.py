import asyncio
import uuid

import dramatiq
import typer

import polar.tasks  # noqa: F401
from polar.config import settings
from polar.redis import create_redis
from polar.worker import JobQueueManager, enqueue_job


async def _enqueue(count: int, redis_key: str, failure: bool) -> None:
    settings.WORKER_SQS_ENABLED = True
    settings.WORKER_SQS_ACTORS = settings.WORKER_SQS_ACTORS | {"dummy"}

    redis = create_redis("script")
    try:
        async with JobQueueManager.open(dramatiq.get_broker(), redis):
            for _ in range(count):
                enqueue_job("dummy", redis_key=redis_key, failure=failure)
    finally:
        await redis.close()


def main(
    count: int = typer.Option(1, "--count", "-n", min=1),
    redis_key: str | None = typer.Option(None, "--redis-key"),
    failure: bool = typer.Option(False, "--failure"),
) -> None:
    key = redis_key or f"dummy:{uuid.uuid4()}"
    asyncio.run(_enqueue(count, key, failure))
    typer.echo(f"Enqueued {count} dummy task(s). Redis key: {key}")


if __name__ == "__main__":
    typer.run(main)
