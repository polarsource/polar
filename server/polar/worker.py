import asyncio
import contextlib
import contextvars
import functools
import random
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import datetime
from enum import Enum
from typing import Any, ParamSpec, TypeAlias, TypedDict, TypeVar, cast

import logfire
import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from arq import func
from arq.connections import ArqRedis, RedisSettings
from arq.connections import create_pool as arq_create_pool
from arq.cron import CronJob
from arq.typing import SecondsTimedelta
from arq.worker import Function
from pydantic import BaseModel

from polar.config import settings
from polar.context import ExecutionContext
from polar.kit.db.postgres import (
    AsyncEngine,
    AsyncSession,
    create_async_sessionmaker,
)
from polar.kit.db.postgres import (
    AsyncSessionMaker as AsyncSessionMakerType,
)
from polar.logfire import instrument_httpx, instrument_sqlalchemy
from polar.logging import generate_correlation_id
from polar.postgres import create_async_engine
from polar.redis import Redis

log = structlog.get_logger()

JobToEnqueue: TypeAlias = tuple[str, tuple[Any], dict[str, Any]]
_jobs_to_enqueue = contextvars.ContextVar[list[JobToEnqueue]](
    "polar_worker_jobs_to_enqueue", default=[]
)


class WorkerContext(TypedDict):
    redis: ArqRedis
    raw_redis: Redis
    async_engine: AsyncEngine
    async_sessionmaker: AsyncSessionMakerType


class JobContext(WorkerContext):
    job_id: str
    job_try: int
    enqueue_time: datetime
    score: int
    exit_stack: contextlib.ExitStack
    logfire_span: logfire.LogfireSpan


def get_worker_redis(ctx: WorkerContext) -> Redis:
    return cast(Redis, ctx["raw_redis"])


class PolarWorkerContext(BaseModel):
    is_during_installation: bool = False

    def to_execution_context(self) -> ExecutionContext:
        return ExecutionContext(is_during_installation=self.is_during_installation)


class QueueName(Enum):
    default = "arq:queue"
    github_crawl = "arq:queue:github_crawl"


class WorkerSettings:
    functions: list[Function] = []
    cron_jobs: list[CronJob] = []
    queue_name: str = QueueName.default.value

    redis_settings = RedisSettings.from_dsn(settings.redis_url)

    @staticmethod
    async def on_startup(ctx: WorkerContext) -> None:
        log.info("polar.worker.startup")

        async_engine = create_async_engine("worker")
        async_sessionmaker = create_async_sessionmaker(async_engine)
        instrument_sqlalchemy(async_engine.sync_engine)
        instrument_httpx()

        # Create a dedicated Redis instance instead of sharing the ARQ one,
        # because we need to have decode_responses=True.
        redis = Redis.from_url(settings.redis_url, decode_responses=True)

        ctx.update(
            {
                "async_engine": async_engine,
                "async_sessionmaker": async_sessionmaker,
                "raw_redis": redis,
            }
        )

    @staticmethod
    async def on_shutdown(ctx: WorkerContext) -> None:
        engine = ctx["async_engine"]
        await engine.dispose()

        redis = ctx["raw_redis"]
        await redis.close()

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
        exit_stack = contextlib.ExitStack()
        function_name = ":".join(ctx["job_id"].split(":")[0:-1])
        logfire_span = exit_stack.enter_context(
            logfire.span("TASK {function_name}", function_name=function_name)
        )
        ctx.update({"exit_stack": exit_stack, "logfire_span": logfire_span})

    @staticmethod
    async def on_job_end(ctx: JobContext) -> None:
        """
        Unfortunately, we don't have access to task arguments in this hook.

        This prevents us to implement things like common arguments handling, as we
        do for `request_correlation_id`.

        To circumvent this limitation, we implement this behavior
        through the `task_hooks` decorator.
        """
        exit_stack = ctx["exit_stack"]
        exit_stack.close()


class WorkerSettingsGitHubCrawl(WorkerSettings):
    queue_name: str = QueueName.github_crawl.value
    functions: list[Function] = []
    cron_jobs: list[CronJob] = []

    redis_settings = RedisSettings.from_dsn(settings.redis_url)

    @staticmethod
    async def on_startup(ctx: WorkerContext) -> None:
        return await WorkerSettings.on_startup(ctx)

    @staticmethod
    async def on_shutdown(ctx: WorkerContext) -> None:
        return await WorkerSettings.on_shutdown(ctx)

    @staticmethod
    async def on_job_start(ctx: JobContext) -> None:
        return await WorkerSettings.on_job_start(ctx)

    @staticmethod
    async def on_job_end(ctx: JobContext) -> None:
        return await WorkerSettings.on_job_end(ctx)


class CronTasksScheduler:
    _cron_tasks: list[tuple[str, CronTrigger, QueueName]] = []

    @staticmethod
    def add_task(task: str, cron_trigger: CronTrigger, queue_name: QueueName) -> None:
        CronTasksScheduler._cron_tasks.append((task, cron_trigger, queue_name))

    def __init__(self) -> None:
        self._loop = asyncio.get_event_loop()
        self._arq_pool: ArqRedis | None = None

    def run(self) -> None:
        main_task = self._loop.create_task(self._main())
        try:
            self._loop.run_until_complete(main_task)
        except asyncio.CancelledError:
            pass

    async def _main(self) -> None:
        self._arq_pool = await arq_create_pool(WorkerSettings.redis_settings)
        scheduler = AsyncIOScheduler()
        for task, cron_trigger, queue_name in CronTasksScheduler._cron_tasks:
            scheduler.add_job(
                self._schedule_task,
                trigger=cron_trigger,
                name=task,
                args=(task, queue_name.value),
            )
        scheduler.start()
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            scheduler.shutdown()
        finally:
            await self._arq_pool.close()

    async def _schedule_task(self, task: str, queue_name: QueueName) -> None:
        if self._arq_pool is None:
            raise RuntimeError("The scheduler is not running")
        await self._arq_pool.enqueue_job(task, _queue_name=str(queue_name))


@contextlib.asynccontextmanager
async def lifespan() -> AsyncIterator[ArqRedis]:
    arq_pool = await arq_create_pool(WorkerSettings.redis_settings)
    try:
        yield arq_pool
    finally:
        await arq_pool.close(True)


def enqueue_job(
    name: str,
    *args: Any,
    queue_name: QueueName = QueueName.default,
    **kwargs: Any,
) -> None:
    ctx = ExecutionContext.current()
    polar_context = PolarWorkerContext(
        is_during_installation=ctx.is_during_installation,
    )

    request_correlation_id = structlog.contextvars.get_contextvars().get(
        "correlation_id"
    )

    # Prefix job ID by task name by default
    _job_id = kwargs.pop("_job_id", f"{name}:{uuid.uuid4().hex}")

    kwargs = {
        "request_correlation_id": request_correlation_id,
        "polar_context": polar_context,
        **kwargs,
        "_job_id": _job_id,
        "_queue_name": queue_name.value,
    }

    _jobs_to_enqueue_list = _jobs_to_enqueue.get([])
    _jobs_to_enqueue_list.append((name, args, kwargs))
    _jobs_to_enqueue.set(_jobs_to_enqueue_list)

    log.debug("polar.worker.job_enqueued", name=name, args=args, kwargs=kwargs)


async def flush_enqueued_jobs(arq_pool: ArqRedis) -> None:
    if _jobs_to_enqueue_list := _jobs_to_enqueue.get([]):
        log.debug("polar.worker.flush_enqueued_jobs")
        for name, args, kwargs in _jobs_to_enqueue_list:
            await arq_pool.enqueue_job(name, *args, **kwargs)
            log.debug("polar.worker.job_flushed", name=name, args=args, kwargs=kwargs)
        _jobs_to_enqueue.set([])


Params = ParamSpec("Params")
ReturnValue = TypeVar("ReturnValue")


def task_hooks(
    f: Callable[Params, Awaitable[ReturnValue]],
) -> Callable[Params, Awaitable[ReturnValue]]:
    @functools.wraps(f)
    async def wrapper(*args: Params.args, **kwargs: Params.kwargs) -> ReturnValue:
        job_context = cast(JobContext, args[0])
        log_context: dict[str, Any] = {
            "correlation_id": generate_correlation_id(),
            "job_id": job_context["job_id"],
            "job_try": job_context["job_try"],
            "enqueue_time": job_context["enqueue_time"].isoformat(),
            "score": job_context["score"],
        }

        request_correlation_id = kwargs.pop("request_correlation_id", None)
        if request_correlation_id is not None:
            log_context["request_correlation_id"] = request_correlation_id

        structlog.contextvars.bind_contextvars(**log_context)
        job_context["logfire_span"].set_attributes(log_context)

        log.info("polar.worker.job_started")
        r = await f(*args, **kwargs)

        arq_pool = job_context["redis"]
        await flush_enqueued_jobs(arq_pool)

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
    cron_trigger: CronTrigger | None = None,
    cron_trigger_queue: QueueName = QueueName.default,
) -> Callable[
    [Callable[Params, Awaitable[ReturnValue]]], Callable[Params, Awaitable[ReturnValue]]
]:
    def decorator(
        f: Callable[Params, Awaitable[ReturnValue]],
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

        # all tasks are registered on both workers
        WorkerSettings.functions.append(new_task)
        WorkerSettingsGitHubCrawl.functions.append(new_task)

        if cron_trigger is not None:
            CronTasksScheduler.add_task(name, cron_trigger, cron_trigger_queue)

        return wrapped

    return decorator


@contextlib.asynccontextmanager
async def AsyncSessionMaker(ctx: JobContext) -> AsyncIterator[AsyncSession]:
    """Helper to open an AsyncSession context manager from the job context."""
    async with ctx["async_sessionmaker"]() as session:
        try:
            yield session
        except:
            await session.rollback()
            raise
        else:
            await session.commit()


def compute_backoff(
    attempts: int,
    *,
    factor: int = 5,  # 5 seconds
    max_backoff: int = 7 * 86400,  # 7 days
    max_exponent: int = 32,
) -> int:
    """
    Compute an exponential backoff value based on some number of attempts.

    Args:
        attempts: The number of attempts so far.
        factor: The exponential factor to use in seconds.
        max_backoff: The maximum backoff value in seconds
        max_exponent: The maximum exponent to use.

    Returns:
        The computed backoff value in seconds.
    """
    exponent = min(attempts, max_exponent)
    backoff = min(factor * 2**exponent, max_backoff)

    # Randomize the backoff value to avoid thundering herd problems.
    backoff /= 2
    backoff = int(backoff + random.uniform(0, backoff))

    return backoff


__all__ = [
    "WorkerSettings",
    "WorkerSettingsGitHubCrawl",
    "task",
    "lifespan",
    "enqueue_job",
    "JobContext",
    "AsyncSessionMaker",
    "ArqRedis",
    "QueueName",
    "CronTrigger",
]
