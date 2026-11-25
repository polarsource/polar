import contextlib
import os
import pathlib
import time
from collections.abc import AsyncIterator, Callable, Coroutine, Iterator

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from psycopg import sql as psycopg_sql
from pydantic_core import Url
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from sqlalchemy_utils import create_database, database_exists, drop_database

from polar.config import settings
from polar.kit.db.postgres import create_async_engine
from polar.models import Model

_active_session: AsyncSession | None = None
_active_engine: AsyncEngine | None = None
_initialized_worker_id: str | None = None
_worker_id: str = "master"


def get_active_session() -> AsyncSession | None:
    return _active_session


def _ensure_database_initialized(worker_id: str) -> None:
    global _initialized_worker_id
    if _initialized_worker_id == worker_id:
        return
    sync_database_url = get_database_url(worker_id, "psycopg")
    if database_exists(sync_database_url):
        drop_database(sync_database_url)
    if TEMPLATE_DATABASE:
        clone_template_database(sync_database_url)
    else:
        create_database(sync_database_url)
        apply_migrations(get_database_url(worker_id))
    _initialized_worker_id = worker_id


def _get_or_create_engine(worker_id: str) -> AsyncEngine:
    global _active_engine
    if _active_engine is None:
        _ensure_database_initialized(worker_id)
        _active_engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}",
            pool_size=settings.DATABASE_POOL_SIZE,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
            prepared_statement_cache_size=500,
            query_cache_size=1024,
        )
    return _active_engine


@contextlib.asynccontextmanager
async def get_lazy_test_session() -> AsyncIterator[AsyncSession]:
    engine = _active_engine
    owns_engine = engine is None
    if engine is None:
        _ensure_database_initialized(_worker_id)
        engine = create_async_engine(
            dsn=get_database_url(_worker_id),
            application_name=f"test_{_worker_id}",
            pool_size=1,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
            prepared_statement_cache_size=500,
            query_cache_size=1024,
        )
    connection = await engine.connect()
    transaction = await connection.begin()
    session = AsyncSession(bind=connection, expire_on_commit=False)
    try:
        yield session
    finally:
        await transaction.rollback()
        await connection.close()
        if owns_engine:
            await engine.dispose()


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


TEMPLATE_DATABASE = os.environ.get("POLAR_TEST_DATABASE_TEMPLATE")

ALEMBIC_CONFIG_FILE = pathlib.Path(__file__).parent.parent.parent / "alembic.ini"


def apply_migrations(asyncpg_database_url: str) -> None:
    alembic_cfg = Config(ALEMBIC_CONFIG_FILE)
    alembic_cfg.attributes["sqlalchemy.url"] = asyncpg_database_url
    command.upgrade(alembic_cfg, "head")


def clone_template_database(sync_database_url: str) -> None:
    assert TEMPLATE_DATABASE is not None
    parsed = make_url(sync_database_url)
    target_db = parsed.database
    assert target_db is not None
    admin_url = parsed.set(
        drivername="postgresql", database="postgres"
    ).render_as_string(hide_password=False)
    create_stmt = psycopg_sql.SQL(
        "CREATE DATABASE {} TEMPLATE {} STRATEGY = FILE_COPY"
    ).format(
        psycopg_sql.Identifier(target_db),
        psycopg_sql.Identifier(TEMPLATE_DATABASE),
    )
    with psycopg.connect(admin_url, autocommit=True) as conn:
        for _ in range(1500):
            try:
                conn.execute(create_stmt)
                return
            except psycopg.errors.ObjectInUse:
                time.sleep(0.02)
    raise RuntimeError(f"Template database {TEMPLATE_DATABASE} never became free")


@pytest.fixture(scope="session", autouse=True)
def track_worker_id(worker_id: str) -> Iterator[None]:
    global _worker_id, _initialized_worker_id, _active_engine
    _worker_id = worker_id
    yield
    if _initialized_worker_id is not None:
        sync_database_url = get_database_url(_initialized_worker_id, "psycopg")
        if database_exists(sync_database_url):
            drop_database(sync_database_url)
        _initialized_worker_id = None
    _active_engine = None


@pytest.fixture(scope="session")
def initialize_test_database(worker_id: str) -> None:
    _ensure_database_initialized(worker_id)


@pytest.fixture(scope="session")
async def database_engine(
    worker_id: str, initialize_test_database: None
) -> AsyncIterator[AsyncEngine]:
    global _active_engine
    engine = _get_or_create_engine(worker_id)
    yield engine
    await engine.dispose()
    _active_engine = None


@pytest.fixture
async def session(
    database_engine: AsyncEngine,
) -> AsyncIterator[AsyncSession]:
    global _active_session
    connection = await database_engine.connect()
    transaction = await connection.begin()

    session = AsyncSession(bind=connection, expire_on_commit=False)
    previous = _active_session
    _active_session = session

    try:
        yield session
    finally:
        _active_session = previous
        await transaction.rollback()
        await connection.close()


SaveFixture = Callable[[Model], Coroutine[None, None, None]]


def save_fixture_factory(session: AsyncSession) -> SaveFixture:
    async def _save_fixture(model: Model) -> None:
        session.add(model)
        await session.flush()

    return _save_fixture


@pytest.fixture
def save_fixture(session: AsyncSession) -> SaveFixture:
    return save_fixture_factory(session)
