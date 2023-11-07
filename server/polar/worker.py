import functools
import types
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager
from datetime import datetime
from typing import (
    Any,
    ParamSpec,
    TypedDict,
    TypeVar,
    cast,
)

import structlog
from arq import cron, func
from arq.connections import ArqRedis, RedisSettings
from arq.connections import create_pool as arq_create_pool
from arq.cron import CronJob
from arq.jobs import Job
from arq.typing import OptionType, SecondsTimedelta, WeekdayOptionType
from arq.worker import Function
from pydantic import BaseModel

from polar.config import settings
from polar.context import ExecutionContext
from polar.kit.db.postgres import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_sessionmaker,
)
from polar.logging import generate_correlation_id
from polar.postgres import create_engine


async def create_pool() -> ArqRedis:
    return await arq_create_pool(WorkerSettings.redis_settings)


arq_pool: ArqRedis | None = None
glob_arq_pool: ArqRedis | None = None


@asynccontextmanager
async def lifespan() -> AsyncIterator[None]:
    global arq_pool
    arq_pool = await create_pool()
    yield
    await arq_pool.close(True)
    arq_pool = None


log = structlog.get_logger()

redis_settings = RedisSettings().from_dsn(settings.redis_url)


class WorkerContext(TypedDict):
    redis: ArqRedis
    engine: AsyncEngine
    sessionmaker: async_sessionmaker[AsyncSession]


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

        engine = create_engine("worker")
        sessionmaker = create_sessionmaker(engine)
        ctx.update({"engine": engine, "sessionmaker": sessionmaker})

    @staticmethod
    async def on_shutdown(ctx: WorkerContext) -> None:
        global arq_pool
        if arq_pool:
            await arq_pool.close(True)
            arq_pool = None
        else:
            raise Exception("arq_pool not set in shutdown")

        engine = ctx["engine"]
        await engine.dispose()

        log.info("polar.worker.shutdown")

    @staticmethod
    async def on_job_start(ctx: JobContext) -> None:
        """
        Unfortunately, we don't have access to task arguments in this hook.

        This prevents us to implement things like common arguments handling, as we
        do for `request_correlation_id`.

        To circumvent this limitation, we implement this behavior
        through the `task_hooks` decorator.
        """

    @staticmethod
    async def on_job_end(ctx: JobContext) -> None:
        """
        Unfortunately, we don't have access to task arguments in this hook.

        This prevents us to implement things like common arguments handling, as we
        do for `request_correlation_id`.

        To circumvent this limitation, we implement this behavior
        through the `task_hooks` decorator.
        """


async def enqueue_job(name: str, *args: Any, **kwargs: Any) -> Job | None:
    ctx = ExecutionContext.current()
    polar_context = PolarWorkerContext(
        is_during_installation=ctx.is_during_installation,
    )

    request_correlation_id = structlog.contextvars.get_contextvars().get(
        "correlation_id"
    )

    return await _enqueue_job(
        name,
        *args,
        request_correlation_id=request_correlation_id,
        polar_context=polar_context,
        **kwargs,
    )


async def _enqueue_job(name: str, *args: Any, **kwargs: Any) -> Job | None:
    if not arq_pool:
        raise Exception("arq_pool is not initialized")

    return await arq_pool.enqueue_job(name, *args, **kwargs)


Params = ParamSpec("Params")
ReturnValue = TypeVar("ReturnValue")


def task_hooks(
    f: Callable[Params, Awaitable[ReturnValue]]
) -> Callable[Params, Awaitable[ReturnValue]]:
    @functools.wraps(f)
    async def wrapper(*args: Params.args, **kwargs: Params.kwargs) -> ReturnValue:
        job_context = cast(JobContext, args[0])
        structlog.contextvars.bind_contextvars(
            correlation_id=generate_correlation_id(),
            job_id=job_context["job_id"],
            job_try=job_context["job_try"],
            enqueue_time=job_context["enqueue_time"].isoformat(),
            score=job_context["score"],
        )

        request_correlation_id = kwargs.pop("request_correlation_id", None)
        if request_correlation_id is not None:
            structlog.contextvars.bind_contextvars(
                request_correlation_id=request_correlation_id
            )

        log.info("polar.worker.job_started")

        r = await f(*args, **kwargs)

        log.info("polar.worker.job_ended")
        structlog.contextvars.unbind_contextvars(
            "correlation_id",
            "request_correlation_id",
            "job_id",
            "job_try",
            "enqueue_time",
            "score",
        )

        return r

    return wrapper


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
        wrapped = task_hooks(f)

        new_task = func(
            wrapped,  # type: ignore
            name=name,
            keep_result=keep_result,
            timeout=timeout,
            keep_result_forever=keep_result_forever,
            max_tries=max_tries,
        )
        WorkerSettings.functions.append(new_task)

        return wrapped

    return decorator


def interval(
    *,
    month: OptionType = None,
    day: OptionType = None,
    weekday: WeekdayOptionType = None,
    hour: OptionType = None,
    minute: OptionType = None,
    second: OptionType = 0,
) -> Callable[
    [Callable[Params, Awaitable[ReturnValue]]], Callable[Params, Awaitable[ReturnValue]]
]:
    def decorator(
        f: Callable[Params, Awaitable[ReturnValue]]
    ) -> Callable[Params, Awaitable[ReturnValue]]:
        wrapped = task_hooks(f)

        new_cron = cron(
            wrapped,  # type: ignore
            month=month,
            day=day,
            weekday=weekday,
            hour=hour,
            minute=minute,
            second=second,
            run_at_startup=False,
        )
        WorkerSettings.cron_jobs.append(new_cron)

        return wrapped

    return decorator


@asynccontextmanager
async def AsyncSessionMaker(ctx: JobContext) -> AsyncIterator[AsyncSession]:
    """Helper to open an AsyncSession context manager from the job context."""
    async with ctx["sessionmaker"]() as session:
        yield session


__all__ = [
    "WorkerSettings",
    "task",
    "lifespan",
    "enqueue_job",
    "JobContext",
    "AsyncSessionMaker",
]
