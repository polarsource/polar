import asyncpg.exceptions
import psycopg.errors
import pytest
from sqlalchemy.exc import DBAPIError

from polar.operational_errors import handle_operational_error


@pytest.mark.parametrize(
    "driver_error",
    [
        asyncpg.exceptions.LockNotAvailableError("could not obtain lock"),
        asyncpg.exceptions.DeadlockDetectedError("deadlock detected"),
        psycopg.errors.LockNotAvailable("could not obtain lock"),
        psycopg.errors.DeadlockDetected("deadlock detected"),
    ],
)
def test_sql_lock_errors_are_operational(driver_error: Exception) -> None:
    with pytest.raises(DBAPIError) as excinfo:
        raise DBAPIError("SELECT 1", None, driver_error) from driver_error
    assert handle_operational_error(excinfo.value)


def test_other_sql_errors_are_not_operational() -> None:
    driver_error = psycopg.errors.UniqueViolation("duplicate key")
    with pytest.raises(DBAPIError) as excinfo:
        raise DBAPIError("SELECT 1", None, driver_error) from driver_error
    assert not handle_operational_error(excinfo.value)
