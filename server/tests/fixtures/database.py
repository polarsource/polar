import functools
import inspect
import warnings
from collections.abc import AsyncIterator, Callable, Coroutine
from pathlib import Path
from uuid import UUID

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture
from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import text

from polar.kit.db.postgres import AsyncEngine, AsyncSession
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.kit.utils import generate_uuid
from polar.models import Model
from polar.postgres import create_engine


class TestModel(Model):
    __test__ = False  # This is a base class, not a test

    __tablename__ = "test_model"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=None)
    uuid: Mapped[UUID] = mapped_column(PostgresUUID, default=generate_uuid)
    int_column: Mapped[int | None] = mapped_column(Integer, default=None, nullable=True)
    str_column: Mapped[str | None] = mapped_column(String, default=None, nullable=True)


@pytest_asyncio.fixture(scope="session")
async def engine() -> AsyncIterator[AsyncEngine]:
    engine = create_engine("app")
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def initialize_test_database(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Model.metadata.drop_all)
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
        await conn.run_sync(Model.metadata.create_all)


polar_directory = Path(__file__).parent.parent.parent / "polar"
tests_directory = Path(__file__).parent.parent.parent / "tests"


def session_commit_spy(
    func: Callable[[], Coroutine[None, None, None]],
) -> Callable[[], Coroutine[None, None, None]]:
    @functools.wraps(func)
    async def _spy_commit() -> None:
        frame = inspect.currentframe()
        outerframes = inspect.getouterframes(frame)

        polar_call: tuple[str, int] | None = None
        tests_call: tuple[str, int] | None = None
        for outerframe in outerframes[::-1]:
            file = outerframe.filename
            if polar_directory in Path(file).parents:
                polar_call = (file, outerframe.lineno)
            elif tests_directory in Path(file).parents:
                tests_call = (file, outerframe.lineno)

        if polar_call is not None:
            warnings.warn(
                f"session.commit() was called from {polar_call[0]}:{polar_call[1]}"
            )
        elif tests_call is not None:
            warnings.warn(
                f"session.commit() was called from {tests_call[0]}:{tests_call[1]}"
            )
        else:
            warnings.warn("session.commit() was called")
        return await func()

    return _spy_commit


@pytest_asyncio.fixture
async def session(
    engine: AsyncEngine,
    mocker: MockerFixture,
    request: pytest.FixtureRequest,
) -> AsyncIterator[AsyncSession]:
    connection = await engine.connect()
    transaction = await connection.begin()

    session = AsyncSession(bind=connection, expire_on_commit=False)

    expunge_spy = mocker.spy(session, "expunge_all")
    mocker.patch.object(
        session, "commit", side_effect=session_commit_spy(session.commit)
    )

    yield session

    await transaction.rollback()
    await connection.close()

    skip_db_assert_marker = request.node.get_closest_marker("skip_db_asserts")
    if skip_db_assert_marker is not None:
        return

    # Assert that session.expunge_all() was called.
    #
    # expunge_all() should be called after the test has been setup, and before
    # the test calls out to the implementation.
    #
    # This is to ensure that we don't rely on the existing state in the Session
    # from creating the tests.
    expunge_spy.assert_called()


SaveFixture = Callable[[Model], Coroutine[None, None, None]]


@pytest_asyncio.fixture
def save_fixture(session: AsyncSession) -> SaveFixture:
    async def _save_fixture(model: Model) -> None:
        session.add(model)
        await session.flush()
        session.expunge(model)

    return _save_fixture
