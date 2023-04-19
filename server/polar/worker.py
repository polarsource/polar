import types
import functools
from datetime import datetime
from typing import Any, TypedDict, ParamSpec, TypeVar, Awaitable, Callable

import structlog
from arq import func, cron
from arq.connections import RedisSettings, ArqRedis, create_pool as arq_create_pool
from arq.jobs import Job
from arq.worker import Function
from arq.typing import SecondsTimedelta, OptionType
from arq.cron import CronJob

from polar.config import settings

log = structlog.get_logger()

redis_settings = RedisSettings().from_dsn(settings.redis_url)


class WorkerContext(TypedDict):
    redis: ArqRedis


class JobContext(WorkerContext):
    job_id: str
    job_try: int
    enqueue_time: datetime
    score: int


class WorkerSettings:
    functions: list[Function | types.CoroutineType] = []
    cron_jobs: list[CronJob] = []

    redis_settings = RedisSettings().from_dsn(settings.redis_url)

    @staticmethod
    async def startup(ctx: WorkerContext) -> None:
        log.info("polar.worker.startup")

    @staticmethod
    async def shutdown(ctx: WorkerContext) -> None:
        log.info("polar.worker.shutdown")

    @staticmethod
    async def on_job_start(ctx: JobContext) -> None:
        structlog.contextvars.bind_contextvars(
            job_id=ctx["job_id"],
            job_try=ctx["job_try"],
            enqueue_time=ctx["enqueue_time"].isoformat(),
            score=ctx["score"],
        )
        log.info("polar.worker.job_started")

    @staticmethod
    async def on_job_end(ctx: JobContext) -> None:
        log.info("polar.worker.job_ended")
        structlog.contextvars.unbind_contextvars(
            "job_id", "job_try", "enqueue_time", "score"
        )


async def create_pool() -> ArqRedis:
    return await arq_create_pool(WorkerSettings.redis_settings)


async def enqueue_job(name: str, *args: Any, **kwargs: Any) -> Job | None:
    redis = await create_pool()
    return await redis.enqueue_job(name, *args, **kwargs)


Params = ParamSpec("Params")
ReturnValue = TypeVar("ReturnValue")


def task(
    name: str,
    *,
    keep_result: SecondsTimedelta | None = None,
    timeout: SecondsTimedelta | None = None,
    keep_result_forever: bool | None = None,
    max_tries: int | None = None,
) -> Callable[
    [Callable[Params, Awaitable[ReturnValue]]], Callable[Params, Awaitable[ReturnValue]]
]:
    def decorator(
        f: Callable[Params, Awaitable[ReturnValue]]
    ) -> Callable[Params, Awaitable[ReturnValue]]:
        new_task = func(
            f,  # type: ignore
            name=name,
            keep_result=keep_result,
            timeout=timeout,
            keep_result_forever=keep_result_forever,
            max_tries=max_tries,
        )
        WorkerSettings.functions.append(new_task)

        @functools.wraps(f)
        async def wrapper(*args: Params.args, **kwargs: Params.kwargs) -> ReturnValue:
            return await f(*args, **kwargs)

        return wrapper

    return decorator


def interval(
    *,
    minute: OptionType = None,
    second: OptionType = None,
) -> Callable[
    [Callable[Params, Awaitable[ReturnValue]]], Callable[Params, Awaitable[ReturnValue]]
]:
    def decorator(
        f: Callable[Params, Awaitable[ReturnValue]]
    ) -> Callable[Params, Awaitable[ReturnValue]]:
        new_cron = cron(
            f, minute=minute, second=second, run_at_startup=True  # type: ignore
        )
        WorkerSettings.cron_jobs.append(new_cron)

        @functools.wraps(f)
        async def wrapper(*args: Params.args, **kwargs: Params.kwargs) -> ReturnValue:
            return await f(*args, **kwargs)

        return wrapper

    return decorator


__all__ = ["WorkerSettings", "task", "create_pool", "enqueue_job", "JobContext"]
