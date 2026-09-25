"""Keep taxonomy script tests off Postgres and MinIO.

The assertions are pure functions. Override the session autouse fixtures that
would open those connections.
"""

from typing import Any

import pytest


@pytest.fixture(scope="session", autouse=True)
def empty_test_bucket(worker_id: str) -> Any:
    return None


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database(worker_id: str) -> None:
    return


@pytest.fixture(autouse=True)
def patch_middlewares() -> None:
    return
