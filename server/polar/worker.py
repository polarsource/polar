from typing import Any, ParamSpec, TypeVar

import structlog
from asgiref.sync import async_to_sync
from celery import Celery, Task
from sqlalchemy.ext.asyncio import async_scoped_session
from contextlib import asynccontextmanager

from polar.config import settings
from polar.postgres import (
    AsyncSession,
    AsyncSessionLocal,
    create_engine,
    create_sessionmaker,
)

log = structlog.get_logger()

Params = ParamSpec("Params")
ReturnValue = TypeVar("ReturnValue")

engine = create_engine(is_celery=True)
session_factory = create_sessionmaker(engine=engine)


@asynccontextmanager
async def db_session_manager(Session: async_scoped_session[AsyncSession]):
    session = Session()
    try:
        yield session
    except:
        await session.rollback()
        raise
    finally:
        await session.close()
        await Session.remove()


class PolarAsyncTask(Task):
    _AsyncSession: async_scoped_session[AsyncSession] | None = None

    def get_current_task_id(self) -> Any:
        return self.request.id

    def get_db_session(self):
        if self._AsyncSession is None:
            self._AsyncSession = async_scoped_session(
                AsyncSessionLocal, scopefunc=self.get_current_task_id
            )

        return db_session_manager(self._AsyncSession)

    async def call_async(self, *args: Any, **kwargs: Any) -> Any:
        res = await self.run(*args, **kwargs)
        return res

    def __call__(self, *args: Any, **kwargs: Any) -> Any:
        if not settings.CELERY_TASK_ALWAYS_EAGER:
            return async_to_sync(self.call_async)(*args, **kwargs)

        # Since we're running Celery in eager mode during test, we're in
        # an asyncio event loop and can skip the async_to_sync wrapper.

        # NOTE! (TODO) We've been getting warnings about not awaiting certain calls
        # in the test suite. Since we're calling this async function synchronously and
        # not managing the coroutine we get back. The two lines below addressed that.
        #
        # However, it introduced a ton of new issues :) Now we're awaiting those calls
        # and turns out they actually trigger a ton of Github API calls. We don't want
        # that at all. So we need to solve that separetly and then uncomment these two
        # lines to have tests without issues and warnings...

        # loop = asyncio.get_running_loop()
        # return loop.create_task(self.call_async(*args, **kwargs))
        return self.call_async(*args, **kwargs)


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
