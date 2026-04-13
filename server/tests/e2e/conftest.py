"""
E2E test configuration — fixture wiring only.

Infrastructure lives in tests/e2e/infra/.
Tests are organized by lifecycle phase:
- purchase/     — buying something (one_time/, subscription/)
- post_purchase/ — actions after order exists (seat claims, benefits)
- lifecycle/     — ongoing subscription events (renewal, retry, cancellation)
"""

from typing import Any
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from pytest_mock import MockerFixture

from polar.auth.scope import Scope
from polar.kit.db.postgres import AsyncSession
from polar.models import Organization, User, UserOrganization
from polar.redis import Redis
from polar.worker import JobQueueManager
from polar.worker._enqueue import _job_queue_manager
from polar.worker._httpx import HTTPXMiddleware
from polar.worker._redis import RedisMiddleware
from polar.worker._sqlalchemy import SQLAlchemyMiddleware
from tests.e2e.infra import (
    DrainFn,
    EmailCapture,
    SchedulerSimulator,
    StripeSimulator,
    TaskDrain,
)
from tests.e2e.infra.email_capture import create_email_sender_mock
from tests.e2e.infra.external_mocks import *  # noqa: F403 — autouse mock fixtures
from tests.e2e.infra.task_drain import build_actor_registry
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture

# Auth preset covering the scopes needed by most E2E purchase flows.
# Use as: @E2E_AUTH on test methods.
E2E_AUTH = pytest.mark.auth(
    AuthSubjectFixture(
        subject="user",
        scopes={
            Scope.web_read,
            Scope.web_write,
            Scope.checkouts_read,
            Scope.checkouts_write,
            Scope.orders_read,
            Scope.subscriptions_read,
            Scope.subscriptions_write,
        },
    )
)


@pytest.fixture(scope="session")
def actor_registry() -> dict[str, Any]:
    return build_actor_registry()


@pytest.fixture(autouse=True)
def _set_job_queue_manager() -> None:
    _job_queue_manager.set(JobQueueManager())


@pytest.fixture(autouse=True)
def _patch_worker_middlewares(
    mocker: MockerFixture,
    session: AsyncSession,
    redis: Redis,
) -> None:
    mocker.patch.object(SQLAlchemyMiddleware, "get_async_session", return_value=session)
    mocker.patch.object(
        SQLAlchemyMiddleware, "get_async_read_session", return_value=session
    )
    mocker.patch.object(RedisMiddleware, "get", return_value=redis)
    mocker.patch.object(HTTPXMiddleware, "get", return_value=MagicMock())


@pytest_asyncio.fixture(autouse=True)
async def _link_user_to_org(
    save_fixture: SaveFixture, user: User, organization: Organization
) -> None:
    """Every E2E test gets the default user linked to the default organization."""
    await save_fixture(UserOrganization(user=user, organization=organization))


@pytest.fixture
def email_capture() -> EmailCapture:
    return EmailCapture()


@pytest.fixture(autouse=True)
def mock_email_sender(mocker: MockerFixture, email_capture: EmailCapture) -> MagicMock:
    mock = create_email_sender_mock(email_capture)
    mocker.patch("polar.email.tasks.email_sender", new=mock)
    return mock


@pytest.fixture
def stripe_sim(mock_stripe_service: MagicMock) -> StripeSimulator:
    return StripeSimulator(mock=mock_stripe_service)


@pytest.fixture
def scheduler_sim(session: AsyncSession) -> SchedulerSimulator:
    """Scheduler simulator for testing subscription job picking."""
    return SchedulerSimulator(session)


@pytest_asyncio.fixture
async def drain(
    session: AsyncSession, redis: Redis, actor_registry: dict[str, Any]
) -> DrainFn:
    """
    Returns a callable that drains all enqueued background tasks.

    Usage::

        result = await drain()
        assert "order.confirmation_email" in result
    """
    task_drain = TaskDrain(session, redis, actor_registry)
    return task_drain.drain
