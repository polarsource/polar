import functools
import types
from contextlib import asynccontextmanager
from datetime import datetime
from typing import (
    Any,
    AsyncGenerator,
    Awaitable,
    Callable,
    ParamSpec,
    TypedDict,
    TypeVar,
)

import structlog
from arq import cron, func
from arq.connections import ArqRedis, RedisSettings
from arq.connections import create_pool as arq_create_pool
from arq.cron import CronJob
from arq.jobs import Job
from arq.typing import OptionType, SecondsTimedelta
from arq.worker import Function
from pydantic import BaseModel

from polar.config import settings
from polar.context import ExecutionContext
from polar.logging import generate_correlation_id


async def create_pool() -> ArqRedis:
    return await arq_create_pool(WorkerSettings.redis_settings)


arq_pool: ArqRedis | None = None
glob_arq_pool: ArqRedis | None = None


@asynccontextmanager
async def lifespan() -> AsyncGenerator[None, Any]:
    global arq_pool
    arq_pool = await create_pool()
    yield
    await arq_pool.close(True)
    arq_pool = None


log = structlog.get_logger()

redis_settings = RedisSettings().from_dsn(settings.redis_url)


class WorkerContext(TypedDict):
    redis: ArqRedis


class JobContext(WorkerContext):
    job_id: str
    job_try: int
    enqueue_time: datetime
    score: int


class PolarWorkerContext(BaseModel):
    is_during_installation: bool = False

    def to_execution_context(self) -> ExecutionContext:
        return ExecutionContext(is_during_installation=self.is_during_installation)


class WorkerSettings:
    functions: list[Function | types.CoroutineType] = []  # type: ignore
    cron_jobs: list[CronJob] = []

    redis_settings = RedisSettings().from_dsn(settings.redis_url)

    @staticmethod
    async def on_startup(ctx: WorkerContext) -> None:
        log.info("polar.worker.startup")
        global arq_pool
        if arq_pool:
            raise Exception("arq_pool already exists in startup")
        arq_pool = await create_pool()

    @staticmethod
    async def on_shutdown(ctx: WorkerContext) -> None:
        log.info("polar.worker.shutdown")
        global arq_pool
        if arq_pool:
            await arq_pool.close(True)
            arq_pool = None
        else:
            raise Exception("arq_pool not set in shutdown")

    @staticmethod
    async def on_job_start(ctx: JobContext) -> None:
        structlog.contextvars.bind_contextvars(
            correlation_id=generate_correlation_id(),
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
            "correlation_id", "job_id", "job_try", "enqueue_time", "score"
        )


async def enqueue_job(name: str, *args: Any, **kwargs: Any) -> Job | None:
    ctx = ExecutionContext.current()
    kwargs["polar_context"] = PolarWorkerContext(
        is_during_installation=ctx.is_during_installation,
    )
    return await _enqueue_job(name, *args, **kwargs)


async def _enqueue_job(name: str, *args: Any, **kwargs: Any) -> Job | None:
    if not arq_pool:
        raise Exception("arq_pool is not initialized")

    return await arq_pool.enqueue_job(name, *args, **kwargs)


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
            f, minute=minute, second=second, run_at_startup=False  # type: ignore
        )
        WorkerSettings.cron_jobs.append(new_cron)

        @functools.wraps(f)
        async def wrapper(*args: Params.args, **kwargs: Params.kwargs) -> ReturnValue:
            return await f(*args, **kwargs)

        return wrapper

    return decorator


__all__ = ["WorkerSettings", "task", "lifespan", "enqueue_job", "JobContext"]
