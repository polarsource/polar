import pytest
from asyncpg.exceptions import QueryCanceledError
from sqlalchemy.dialects.postgresql.asyncpg import AsyncAdapt_asyncpg_dbapi
from sqlalchemy.exc import DBAPIError

from polar.operational_errors import handle_operational_error


@pytest.mark.parametrize(
    ("message", "is_operational"),
    [
        ("canceling statement due to statement timeout", True),
        ("canceling statement due to user request", False),
    ],
)
def test_postgres_query_canceled(message: str, is_operational: bool) -> None:
    driver_error = AsyncAdapt_asyncpg_dbapi.Error(message)
    driver_error.__cause__ = QueryCanceledError(message)
    error = DBAPIError(None, None, driver_error)
    error.__cause__ = driver_error

    assert handle_operational_error(error) is is_operational
