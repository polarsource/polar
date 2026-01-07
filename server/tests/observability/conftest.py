"""Conftest for observability tests - isolated from main fixtures.

These tests are designed to run in isolation without requiring the full
Polar infrastructure (database, Minio, Redis, etc.). We override the
session-scoped autouse fixtures from the main test suite to prevent
connection attempts.
"""

import os
from collections.abc import Iterator
from typing import Any

import pytest

# Set up test environment before any polar imports
os.environ["POLAR_ENV"] = "testing"


@pytest.fixture(scope="session", autouse=True)
def setup_prometheus_test_env(tmp_path_factory: pytest.TempPathFactory) -> None:
    """Set up prometheus multiprocess directory for all tests."""
    prom_dir = tmp_path_factory.mktemp("prometheus_multiproc")
    os.environ["PROMETHEUS_MULTIPROC_DIR"] = str(prom_dir)


@pytest.fixture(scope="session", autouse=True)
def empty_test_bucket(worker_id: str) -> Iterator[Any]:
    """Override the main test bucket fixture to avoid Minio connections.

    The observability tests don't need S3/Minio access.
    """
    yield None


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database(worker_id: str) -> Iterator[None]:
    """Override the main database fixture to avoid PostgreSQL connections.

    The observability tests don't need database access.
    """
    yield None


@pytest.fixture(autouse=True)
def patch_middlewares() -> None:
    """Override the main worker middleware fixture.

    The observability tests don't need worker middleware patching.
    """
    pass


@pytest.fixture(autouse=True)
def set_job_queue_manager_context() -> None:
    """Override the main job queue manager fixture.

    The observability tests don't need the job queue manager.
    """
    pass


@pytest.fixture(autouse=True)
def current_message() -> Iterator[Any]:
    """Override the main current message fixture.

    The observability tests don't need dramatiq messages.
    """
    yield None
