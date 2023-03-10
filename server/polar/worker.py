from typing import Any, ParamSpec, TypeVar

import structlog
from asgiref.sync import async_to_sync
from celery import Celery, Task
from sqlalchemy.ext.asyncio import async_scoped_session

from polar.config import settings
from polar.postgres import AsyncSession, create_engine, create_sessionmaker

log = structlog.get_logger()

Params = ParamSpec("Params")
ReturnValue = TypeVar("ReturnValue")

engine = create_engine(is_celery=True)
session_factory = create_sessionmaker(engine=engine)


class PolarAsyncTask(Task):
    _AsyncSession: async_scoped_session[AsyncSession] | None = None

    def get_current_task_id(self) -> Any:
        return self.request.id

    @property
    def AsyncSession(self) -> async_scoped_session[AsyncSession]:
        if self._AsyncSession is None:
            self._AsyncSession = async_scoped_session(
                session_factory, scopefunc=self.get_current_task_id
            )

        return self._AsyncSession

    async def call_async(self, *args: Any, **kwargs: Any) -> Any:
        res = await self.run(*args, **kwargs)
        if self._AsyncSession is not None:
            await self._AsyncSession.remove()
        return res

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        if settings.CELERY_TASK_ALWAYS_EAGER:
            # Since we're running Celery in eager mode during test, we're in
            # an asyncio event loop and can skip the async_to_sync wrapper.
            return self.call_async(*args, **kwargs)

        return async_to_sync(self.call_async)(*args, **kwargs)


app = Celery(
    "polar",
    backend=settings.CELERY_BACKEND_URL,
    broker=settings.CELERY_BROKER_URL,
    task_cls="polar.worker.PolarAsyncTask",
)
app.conf.update(
    task_always_eager=settings.CELERY_TASK_ALWAYS_EAGER,
)
task = app.task
