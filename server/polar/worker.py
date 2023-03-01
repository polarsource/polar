import contextlib
import functools
from typing import Awaitable, Callable, ParamSpec, TypeVar

from asgiref.sync import async_to_sync
from celery import Celery

from polar import receivers  # noqa
from polar.config import settings
from polar.postgres import create_engine, create_sessionmaker

app = Celery(
    "polar", backend=settings.CELERY_BACKEND_URL, broker=settings.CELERY_BROKER_URL
)
app.conf.update(
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
)
task = app.task


Params = ParamSpec("Params")
ReturnValue = TypeVar("ReturnValue")

AsyncSessionLocal = create_sessionmaker(engine=create_engine(is_celery=True))


def sync_worker() -> Callable[
    [Callable[Params, ReturnValue]], Callable[Params, ReturnValue]
]:
    def a2s(
        f: Callable[Params, Awaitable[ReturnValue]]
    ) -> Callable[Params, Awaitable[ReturnValue]]:
        # Since we're running Celery in eager mode during test, we're in
        # an asyncio event loop and can skip the async_to_sync wrapper.
        if settings.CELERY_TASK_ALWAYS_EAGER:
            return f
        return async_to_sync(f)

    def decorator(f: Callable[Params, ReturnValue]) -> Callable[Params, ReturnValue]:
        @functools.wraps(f)
        def wrapper(*args: Params.args, **kwargs: Params.kwargs) -> ReturnValue:
            return a2s(f)(*args, **kwargs)

        return wrapper

    return decorator


@contextlib.asynccontextmanager
async def get_db_session():
    try:
        engine = create_engine(is_celery=True)
        db = create_sessionmaker(engine=engine)()
        yield db
    finally:
        await db.close()
        await engine.dispose()
