import functools
from typing import Awaitable, Callable, ParamSpec, TypeVar

from asgiref.sync import async_to_sync
from celery import Celery

from polar.config import settings
from polar.postgres import AsyncSessionLocal

app = Celery(
    "polar", backend=settings.CELERY_BACKEND_URL, broker=settings.CELERY_BROKER_URL
)
app.conf.update(
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
)
task = app.task


Params = ParamSpec("Params")
ReturnValue = TypeVar("ReturnValue")


def asyncify_task(
    with_session: bool = False,
) -> Callable[[Callable[Params, ReturnValue]], Callable[Params, ReturnValue]]:
    async def inject_session(
        f: Callable[Params, Awaitable[ReturnValue]],
        *args: Params.args,
        **kwargs: Params.kwargs
    ) -> ReturnValue:
        async with AsyncSessionLocal() as session:
            return await f(session, *args, **kwargs)

    def decorator(f: Callable[Params, ReturnValue]) -> Callable[Params, ReturnValue]:
        @functools.wraps(f)
        def wrapper(*args: Params.args, **kwargs: Params.kwargs) -> ReturnValue:
            if not with_session:
                return async_to_sync(f)(*args, **kwargs)  # type: ignore
            return async_to_sync(inject_session)(f, *args, **kwargs)  # type: ignore

        return wrapper

    return decorator
