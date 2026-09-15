"""Conftest for observability tests - isolated from main fixtures.

These tests are designed to run in isolation without requiring the full
Polar infrastructure (database, Minio, Redis, etc.). We override the
session-scoped autouse fixtures from the main test suite to prevent
connection attempts.
"""

import os

# Set up test environment before any polar imports
os.environ["POLAR_ENV"] = "testing"

from collections.abc import Iterator
from typing import Any

import logfire
import pytest
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pytest_mock import MockerFixture

from polar.logfire import configure_logfire


@pytest.fixture
def configured_logfire(
    mocker: MockerFixture,
) -> Iterator[tuple[logfire.Logfire, InMemorySpanExporter]]:
    exporter = InMemorySpanExporter()
    configure = logfire.configure
    instances: list[logfire.Logfire] = []

    def configure_local(**kwargs: Any) -> logfire.Logfire:
        kwargs.update(local=True, send_to_logfire=False, metrics=False)
        kwargs["additional_span_processors"].append(SimpleSpanProcessor(exporter))
        instance = configure(**kwargs)
        instance.error("initialize cached tracer")
        exporter.clear()
        instances.append(instance)
        return instance

    mocker.patch("polar.logfire.settings.S3_LOGS_BUCKET_NAME", None)
    mocker.patch("polar.logfire.logfire.configure", side_effect=configure_local)
    configure_logfire("server")
    instance = instances[0]
    yield instance, exporter
    instance.config.get_tracer_provider().shutdown()


@pytest.fixture(scope="session", autouse=True)
def setup_prometheus_test_env(tmp_path_factory: pytest.TempPathFactory) -> None:
    """Set up prometheus multiprocess directory for all tests."""
    prom_dir = tmp_path_factory.mktemp("prometheus_multiproc")
    os.environ["PROMETHEUS_MULTIPROC_DIR"] = str(prom_dir)


@pytest.fixture(scope="session", autouse=True)
def empty_test_bucket(worker_id: str) -> Any:
    """Override the main test bucket fixture to avoid Minio connections.

    The observability tests don't need S3/Minio access.
    """
    return None


@pytest.fixture(scope="session", autouse=True)
def initialize_test_database(worker_id: str) -> None:
    """Override the main database fixture to avoid PostgreSQL connections.

    The observability tests don't need database access.
    """
    return


@pytest.fixture(autouse=True)
def patch_middlewares() -> None:
    """Override the main worker middleware fixture.

    The observability tests don't need worker middleware patching.
    """


@pytest.fixture(autouse=True)
def set_job_queue_manager_context() -> None:
    """Override the main job queue manager fixture.

    The observability tests don't need the job queue manager.
    """


@pytest.fixture(autouse=True)
def current_message() -> Any:
    """Override the main current message fixture.

    The observability tests don't need dramatiq messages.
    """
    return None
