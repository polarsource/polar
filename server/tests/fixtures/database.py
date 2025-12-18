from collections.abc import AsyncIterator, Callable, Coroutine

import pytest
import pytest_asyncio
from alembic_utils.pg_trigger import PGTrigger
from alembic_utils.replaceable_entity import registry as entities_registry
from pydantic_core import Url
from pytest_mock import MockerFixture
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.schema import CreateSequence
from sqlalchemy_utils import create_database, database_exists, drop_database

from polar.config import settings
from polar.kit.db.postgres import create_async_engine
from polar.models import Model
from polar.models.customer import Customer


def get_database_url(worker_id: str, driver: str = "asyncpg") -> str:
    return str(
        Url.build(
            scheme=f"postgresql+{driver}",
            username=settings.POSTGRES_USER,
            password=settings.POSTGRES_PWD,
            host=settings.POSTGRES_HOST,
            port=settings.POSTGRES_PORT,
            path=f"{settings.POSTGRES_DATABASE}_{worker_id}",
        )
    )


@pytest_asyncio.fixture(scope="session", loop_scope="session", autouse=True)
async def initialize_test_database(worker_id: str) -> AsyncIterator[None]:
    sync_database_url = get_database_url(worker_id, "psycopg2")

    if database_exists(sync_database_url):
        drop_database(sync_database_url)

    create_database(sync_database_url)

    engine = create_async_engine(
        dsn=get_database_url(worker_id),
        application_name=f"test_{worker_id}",
        pool_size=settings.DATABASE_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
    )

    async with engine.begin() as conn:
        await conn.execute(CreateSequence(Customer.short_id_sequence))
        for entity in entities_registry.entities():
            if isinstance(entity, PGTrigger):
                continue
            await conn.execute(entity.to_sql_statement_create())
        await conn.run_sync(Model.metadata.create_all)
        for entity in entities_registry.entities():
            if not isinstance(entity, PGTrigger):
                continue
            await conn.execute(entity.to_sql_statement_create())
    await engine.dispose()

    yield

    drop_database(sync_database_url)


@pytest_asyncio.fixture
async def session(worker_id: str, mocker: MockerFixture) -> AsyncIterator[AsyncSession]:
    engine = create_async_engine(
        dsn=get_database_url(worker_id),
        application_name=f"test_{worker_id}",
        pool_size=settings.DATABASE_POOL_SIZE,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
    )
    connection = await engine.connect()
    transaction = await connection.begin()

    session = AsyncSession(bind=connection, expire_on_commit=False)

    yield session

    await transaction.rollback()
    await connection.close()
    await engine.dispose()


SaveFixture = Callable[[Model], Coroutine[None, None, None]]


def save_fixture_factory(session: AsyncSession) -> SaveFixture:
    async def _save_fixture(model: Model) -> None:
        session.add(model)
        await session.flush()

    return _save_fixture


@pytest.fixture
def save_fixture(session: AsyncSession) -> SaveFixture:
    return save_fixture_factory(session)
