"""Conftest for observability tests - isolated from main fixtures.

These tests are designed to run in isolation without requiring the full
Polar infrastructure (database, Minio, Redis, etc.). We override the
session-scoped autouse fixtures from the main test suite to prevent
connection attempts.
"""

import logging
import os
from functools import partial
from io import StringIO

# Set up test environment before any polar imports
os.environ["POLAR_ENV"] = "testing"

from collections.abc import Iterator
from typing import Any

import logfire
import pytest
import sentry_sdk
import structlog
from logfire.integrations.structlog import LogfireProcessor
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pytest_mock import MockerFixture

from polar.logfire import configure_logfire
from polar.logging import Development, Logger, Production

type LoggingPipeline = tuple[
    Logger, logging.Logger, StringIO, InMemorySpanExporter | None
]


@pytest.fixture(autouse=True)
def isolated_sentry_scope() -> Iterator[None]:
    with sentry_sdk.isolation_scope() as scope:
        scope.clear()
        sentry_sdk.get_current_scope().clear()
        yield


@pytest.fixture(
    params=[(Development, False), (Production, False), (Production, True)],
    ids=["console", "json", "json-with-logfire"],
)
def logging_pipeline(
    request: pytest.FixtureRequest,
    mocker: MockerFixture,
    configured_logfire: tuple[logfire.Logfire, InMemorySpanExporter],
) -> Iterator[LoggingPipeline]:
    configuration, forward_to_logfire = request.param
    instance, exporter = configured_logfire
    mocker.patch(
        "polar.logging.LogfireProcessor",
        partial(LogfireProcessor, logfire_instance=instance),
    )
    dict_config = mocker.patch("polar.logging.logging.config.dictConfig")
    configuration.configure_stdlib(logfire=forward_to_logfire)
    formatter_config: dict[str, Any] = dict_config.call_args.args[0]["formatters"][
        "polar"
    ]
    formatter_type = formatter_config.pop("()")
    stream = StringIO()
    handler = logging.StreamHandler(stream)
    handler.setFormatter(formatter_type(**formatter_config))
    stdlib_logger = logging.getLogger("polar.pii_validation")
    mocker.patch.object(stdlib_logger, "handlers", [handler])
    mocker.patch.object(stdlib_logger, "level", logging.DEBUG)
    mocker.patch.object(stdlib_logger, "disabled", False)
    mocker.patch.object(stdlib_logger, "propagate", False)
    logger = structlog.wrap_logger(
        stdlib_logger,
        processors=configuration.get_processors(logfire=forward_to_logfire),
        wrapper_class=structlog.stdlib.BoundLogger,
    )
    yield logger, stdlib_logger, stream, exporter if forward_to_logfire else None
    handler.close()


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
