"""
Fixtures for E2E tests.

These fixtures provide:
- Test data factories for billing scenarios
- Task execution via StubBroker
- HTTP client for API testing
"""

import contextlib
from collections.abc import AsyncGenerator, AsyncIterator, Iterator
from typing import Any
from unittest.mock import MagicMock, patch

import dramatiq
import httpx
import pytest
import pytest_asyncio
from dramatiq.brokers.stub import StubBroker
from dramatiq.middleware.current_message import CurrentMessage
from fastapi import FastAPI
from pytest_mock import MockerFixture

from polar.app import app as polar_app
from polar.auth.dependencies import _auth_subject_factory_cache
from polar.auth.models import Anonymous, AuthSubject
from polar.auth.scope import Scope
from polar.checkout.ip_geolocation import _get_client_dependency
from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.models import Account, Organization, User, UserOrganization
from polar.postgres import get_db_read_session, get_db_session
from polar.redis import Redis, get_redis
from polar.worker import JobQueueManager, RedisMiddleware
from polar.worker._enqueue import _job_queue_manager
from polar.worker._httpx import HTTPXMiddleware
from tests.e2e.worker.broker import create_test_broker, register_actors_to_broker
from tests.e2e.worker.executor import TaskExecutor
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_organization,
    create_user,
)


# =============================================================================
# HTTP Client for API Testing
# =============================================================================


@pytest_asyncio.fixture
async def billing_app(
    session: AsyncSession,
    redis: Redis,
) -> AsyncGenerator[FastAPI, None]:
    """
    FastAPI app configured for billing E2E tests.

    Sets up dependency overrides for database session and redis,
    and uses anonymous auth by default.
    """
    anon_subject = AuthSubject(Anonymous(), {Scope.web_read, Scope.web_write}, None)

    # Override dependencies
    polar_app.dependency_overrides[get_db_session] = lambda: session
    polar_app.dependency_overrides[get_db_read_session] = lambda: session
    polar_app.dependency_overrides[get_redis] = lambda: redis
    polar_app.dependency_overrides[_get_client_dependency] = lambda: None

    # Override all auth subject getters to return anonymous by default
    for auth_subject_getter in _auth_subject_factory_cache.values():
        polar_app.dependency_overrides[auth_subject_getter] = lambda: anon_subject

    yield polar_app

    # Cleanup
    polar_app.dependency_overrides.pop(get_db_session, None)
    polar_app.dependency_overrides.pop(get_db_read_session, None)
    polar_app.dependency_overrides.pop(get_redis, None)
    polar_app.dependency_overrides.pop(_get_client_dependency, None)
    for auth_subject_getter in _auth_subject_factory_cache.values():
        polar_app.dependency_overrides.pop(auth_subject_getter, None)


@pytest_asyncio.fixture
async def client(billing_app: FastAPI) -> AsyncGenerator[httpx.AsyncClient, None]:
    """HTTP client for making API requests in billing E2E tests."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=billing_app),
        base_url="http://test",
    ) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def mock_email(mocker: MockerFixture) -> MagicMock:
    """Mock email sending."""
    return mocker.patch("polar.email.sender.enqueue_email")


# =============================================================================
# Test Data Factories
# =============================================================================


@pytest_asyncio.fixture
async def billing_organization(save_fixture: SaveFixture) -> Organization:
    """Organization configured for billing tests."""
    return await create_organization(
        save_fixture,
        name_prefix="billing_test_org",
        default_presentment_currency="usd",
    )


@pytest_asyncio.fixture
async def billing_user(
    save_fixture: SaveFixture, billing_organization: Organization
) -> User:
    """User with organization membership for billing tests."""
    user = await create_user(save_fixture)
    user_org = UserOrganization(user=user, organization=billing_organization)
    await save_fixture(user_org)
    return user


@pytest_asyncio.fixture
async def billing_account(
    save_fixture: SaveFixture,
    billing_organization: Organization,
    billing_user: User,
) -> Account:
    """Stripe account for the organization."""
    return await create_account(
        save_fixture,
        billing_organization,
        billing_user,
        status=Account.Status.ACTIVE,
    )


# =============================================================================
# Task Execution Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def httpx_client() -> AsyncIterator[httpx.AsyncClient]:
    """HTTP client for external requests in tasks."""
    test_client = httpx.AsyncClient()
    yield test_client
    await test_client.aclose()


@pytest.fixture
def test_broker() -> Iterator[StubBroker]:
    """StubBroker with all Polar actors registered."""
    broker = create_test_broker()
    register_actors_to_broker(broker)
    yield broker
    broker.close()


@pytest.fixture
def task_executor(test_broker: StubBroker, redis: Redis) -> TaskExecutor:
    """Helper to execute pending tasks directly."""
    return TaskExecutor(test_broker, redis)


@pytest.fixture
def patch_broker(test_broker: StubBroker) -> Iterator[None]:
    """Patch dramatiq.get_broker to return the test broker."""
    with patch("dramatiq.get_broker", return_value=test_broker):
        yield


@pytest.fixture
def patch_task_middlewares(
    mocker: MockerFixture,
    session: AsyncSession,
    redis: Redis,
    httpx_client: httpx.AsyncClient,
) -> None:
    """Patch middleware to use test session and redis for task execution."""

    @contextlib.asynccontextmanager
    async def mock_async_session_maker() -> AsyncIterator[AsyncSession]:
        """Mock that returns the test session WITHOUT committing."""
        yield session

    modules_using_async_session_maker = [
        "polar.worker._sqlalchemy",
        "polar.worker",
        "polar.checkout.tasks",
        "polar.subscription.tasks",
        "polar.order.tasks",
        "polar.customer.tasks",
        "polar.benefit.tasks",
        "polar.event.tasks",
        "polar.external_event.tasks",
        "polar.email_update.tasks",
        "polar.auth.tasks",
        "polar.personal_access_token.tasks",
        "polar.organization_access_token.tasks",
        "polar.customer_session.tasks",
        "polar.customer_meter.tasks",
        "polar.meter.tasks",
        "polar.integrations.stripe.tasks",
    ]

    for module in modules_using_async_session_maker:
        try:
            mocker.patch(
                f"{module}.AsyncSessionMaker", side_effect=mock_async_session_maker
            )
        except AttributeError:
            pass

    mocker.patch.object(RedisMiddleware, "get", return_value=redis)
    mocker.patch.object(HTTPXMiddleware, "get", return_value=httpx_client)


@pytest.fixture
def current_message() -> Iterator[dramatiq.Message[Any]]:
    """Set up a current message context for task execution."""
    message: dramatiq.Message[Any] = dramatiq.Message(
        queue_name="default",
        actor_name="actor",
        args=(),
        kwargs={},
        options={"retries": 0, "max_retries": settings.WORKER_MAX_RETRIES},
    )
    CurrentMessage._MESSAGE.set(message)
    yield message
    CurrentMessage._MESSAGE.set(None)


@pytest.fixture
def set_job_queue_manager() -> Iterator[JobQueueManager]:
    """Initialize the JobQueueManager context for task execution."""
    manager = JobQueueManager()
    _job_queue_manager.set(manager)
    yield manager
    _job_queue_manager.set(None)
