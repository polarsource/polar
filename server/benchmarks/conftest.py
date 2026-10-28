import os

os.environ["POLAR_ENV"] = "testing"

import asyncio
import collections.abc
import gc
import typing
import uuid

import pytest
from sqlalchemy.ext.asyncio import AsyncSession as SQLAlchemyAsyncSession
from sqlalchemy_utils import create_database, database_exists, drop_database

from polar.config import settings
from polar.kit.db.postgres import AsyncSession, create_async_engine
from polar.models import Organization, Reducer
from polar.redis import Redis
from polar.reducer.service import reducer as reducer_service
from polar.worker import JobQueueManager
from polar.worker._enqueue import _job_queue_manager
from tests.fixtures.database import (
    SaveFixture,
    apply_migrations,
    get_database_url,
    save_fixture_factory,
)
from tests.fixtures.random_objects import (
    create_account,
    create_meter,
    create_organization,
    create_user,
)

DATABASE = "benchmarks"
# A database index of its own: the benchmarks flush it.
REDIS_DB = 15

T = typing.TypeVar("T")
Run = collections.abc.Callable[[collections.abc.Awaitable[T]], T]


# pytest-codspeed cannot benchmark a coroutine (CodSpeedHQ/pytest-codspeed#101): one event loop
# drives the async calls, and its constant overhead is part of every measurement.
@pytest.fixture(scope="session")
def loop() -> collections.abc.Iterator[asyncio.AbstractEventLoop]:
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
def run(loop: asyncio.AbstractEventLoop) -> Run[typing.Any]:
    return loop.run_until_complete


@pytest.fixture(scope="session", autouse=True)
def database() -> collections.abc.Iterator[None]:
    sync_url = get_database_url(DATABASE, "psycopg2")
    if database_exists(sync_url):
        drop_database(sync_url)
    create_database(sync_url)
    apply_migrations(get_database_url(DATABASE))
    yield
    drop_database(sync_url)


@pytest.fixture
def session(run: Run[typing.Any]) -> collections.abc.Iterator[AsyncSession]:
    engine = create_async_engine(
        dsn=get_database_url(DATABASE),
        application_name="benchmarks",
        pool_size=settings.DATABASE_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
    )
    connection = run(engine.connect())
    transaction = run(connection.begin())
    yield typing.cast(
        AsyncSession, SQLAlchemyAsyncSession(bind=connection, expire_on_commit=False)
    )
    run(transaction.rollback())
    run(connection.close())
    run(engine.dispose())


@pytest.fixture
def redis(run: Run[typing.Any]) -> collections.abc.Iterator[Redis]:
    client = Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=REDIS_DB,
        decode_responses=True,
    )
    run(client.flushdb())
    yield client
    run(client.flushdb())
    run(client.close())


@pytest.fixture(autouse=True)
def job_queue() -> collections.abc.Iterator[JobQueueManager]:
    manager = JobQueueManager()
    token = _job_queue_manager.set(manager)
    yield manager
    _job_queue_manager.reset(token)


# A collection landing inside a measured call costs more than the call; measure allocations, not
# the collector's schedule.
@pytest.fixture(autouse=True)
def no_gc() -> collections.abc.Iterator[None]:
    gc.collect()
    gc.disable()
    yield
    gc.enable()


@pytest.fixture
def save_fixture(session: AsyncSession) -> SaveFixture:
    return save_fixture_factory(session)


@pytest.fixture
def organization(run: Run[typing.Any], save_fixture: SaveFixture) -> Organization:
    async def seed() -> Organization:
        user = await create_user(save_fixture)
        account = await create_account(save_fixture, user)
        return await create_organization(save_fixture, account)

    return run(seed())


async def create_metered_reducer(
    session: AsyncSession, save_fixture: SaveFixture, organization: Organization
) -> Reducer:
    """A meter and its reducers, as the meter service creates them."""
    meter = await create_meter(save_fixture, organization=organization, id=uuid.uuid4())
    reducer = await reducer_service.sync_meter(session, meter)
    await session.flush()
    return reducer
