import contextlib
from collections.abc import AsyncIterator

import dramatiq
import structlog
from dramatiq.asyncio import get_event_loop_thread

from polar.kit.db.postgres import AsyncSessionMaker as AsyncSessionMakerType
from polar.kit.db.postgres import create_async_sessionmaker
from polar.logfire import instrument_sqlalchemy
from polar.logging import Logger
from polar.postgres import AsyncEngine, AsyncSession, create_async_engine

log: Logger = structlog.get_logger()

_sqlalchemy_engine: AsyncEngine | None = None
_sqlalchemy_async_sessionmaker: AsyncSessionMakerType | None = None


async def dispose_sqlalchemy_engine() -> None:
    global _sqlalchemy_engine
    if _sqlalchemy_engine is not None:
        await _sqlalchemy_engine.dispose()
        log.info("Disposed SQLAlchemy engine")
        _sqlalchemy_engine = None


class SQLAlchemyMiddleware(dramatiq.Middleware):
    """
    Middleware managing the lifecycle of the database engine and sessionmaker.
    """

    @classmethod
    def get_async_session(cls) -> contextlib.AbstractAsyncContextManager[AsyncSession]:
        global _sqlalchemy_async_sessionmaker
        if _sqlalchemy_async_sessionmaker is None:
            raise RuntimeError("SQLAlchemy not initialized")
        return _sqlalchemy_async_sessionmaker()

    def before_worker_boot(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        global _sqlalchemy_engine, _sqlalchemy_async_sessionmaker
        _sqlalchemy_engine = create_async_engine("worker")
        _sqlalchemy_async_sessionmaker = create_async_sessionmaker(_sqlalchemy_engine)
        instrument_sqlalchemy([_sqlalchemy_engine.sync_engine])
        log.info("Created database engine")

    def after_worker_shutdown(
        self, broker: dramatiq.Broker, worker: dramatiq.Worker
    ) -> None:
        event_loop_thread = get_event_loop_thread()
        assert event_loop_thread is not None
        event_loop_thread.run_coroutine(dispose_sqlalchemy_engine())


@contextlib.asynccontextmanager
async def AsyncSessionMaker() -> AsyncIterator[AsyncSession]:
    """
    Context manager to handle a database session taken from the middleware context.
    """
    async with SQLAlchemyMiddleware.get_async_session() as session:
        try:
            yield session
        except:
            await session.rollback()
            raise
        else:
            await session.commit()
