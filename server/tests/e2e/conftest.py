"""
Fixtures for E2E tests.

These fixtures provide:
- Real Redis connection (not FakeAsyncRedis)
- Task execution via real Redis message transport
- Single-point middleware patching (no per-module AsyncSessionMaker patches)
- Test data factories for billing scenarios
- HTTP client for API testing
"""

import contextlib
from collections.abc import AsyncGenerator, AsyncIterator, Iterator
from unittest.mock import MagicMock

import httpx
import pytest
import pytest_asyncio
from pytest_mock import MockerFixture
from redis.asyncio import Redis as AsyncRedis

from polar.app import app as polar_app
from polar.auth.dependencies import _auth_subject_factory_cache
from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.checkout.ip_geolocation import _get_client_dependency
from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.models import Account, Organization, User, UserOrganization
from polar.postgres import get_db_read_session, get_db_session
from polar.redis import Redis, get_redis
from polar.worker import JobQueueManager
from polar.worker._enqueue import _job_queue_manager
from polar.worker._httpx import HTTPXMiddleware
from polar.worker._redis import RedisMiddleware
from polar.worker._sqlalchemy import SQLAlchemyMiddleware
from tests.e2e.worker.executor import TaskExecutor
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_account,
    create_organization,
    create_user,
)

# =============================================================================
# Real Redis (Step 1)
# =============================================================================


def _get_e2e_redis_db(worker_id: str) -> int:
    """Map pytest-xdist worker ID to a Redis DB index for isolation.

    Worker 'gw0' -> DB 1, 'gw1' -> DB 2, etc.
    DB 0 is reserved for the application.
    Falls back to DB 1 when not running under xdist.
    """
    if worker_id == "master":
        return 1
    try:
        return int(worker_id.replace("gw", "")) + 1
    except (ValueError, AttributeError):
        return 1


@pytest_asyncio.fixture
async def redis(worker_id: str) -> AsyncIterator[Redis]:
    """Real Redis connection for E2E tests.

    Overrides the FakeAsyncRedis fixture from tests/fixtures/redis.py.
    Each xdist worker gets its own Redis DB for parallel isolation.
    """
    db_index = _get_e2e_redis_db(worker_id)
    client: Redis = AsyncRedis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=db_index,
        decode_responses=True,
    )
    # Clean state before each test
    await client.flushdb()

    yield client

    # Clean up after test
    await client.flushdb()
    await client.aclose()


# =============================================================================
# HTTP Client for API Testing
# =============================================================================


@pytest_asyncio.fixture
async def e2e_app(
    session: AsyncSession,
    redis: Redis,
    billing_user: User,
) -> AsyncGenerator[None]:
    """
    FastAPI app configured for E2E tests.

    Sets up dependency overrides for database session and redis,
    and authenticates as the billing_user by default.
    """
    auth_subject = AuthSubject(
        billing_user, {Scope.web_read, Scope.web_write}, None
    )

    # Override dependencies
    polar_app.dependency_overrides[get_db_session] = lambda: session
    polar_app.dependency_overrides[get_db_read_session] = lambda: session
    polar_app.dependency_overrides[get_redis] = lambda: redis
    polar_app.dependency_overrides[_get_client_dependency] = lambda: None

    # Override all auth subject getters to return the billing user
    for auth_subject_getter in _auth_subject_factory_cache.values():
        polar_app.dependency_overrides[auth_subject_getter] = lambda: auth_subject

    yield

    # Cleanup
    polar_app.dependency_overrides.pop(get_db_session, None)
    polar_app.dependency_overrides.pop(get_db_read_session, None)
    polar_app.dependency_overrides.pop(get_redis, None)
    polar_app.dependency_overrides.pop(_get_client_dependency, None)
    for auth_subject_getter in _auth_subject_factory_cache.values():
        polar_app.dependency_overrides.pop(auth_subject_getter, None)


@pytest_asyncio.fixture
async def client(e2e_app: None) -> AsyncGenerator[httpx.AsyncClient, None]:
    """HTTP client for making API requests in E2E tests."""
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=polar_app),
        base_url="http://test",
    ) as test_client:
        yield test_client


@pytest.fixture(autouse=True)
def mock_email(mocker: MockerFixture) -> MagicMock:
    """Mock email sending."""
    return mocker.patch("polar.email.sender.enqueue_email")


@pytest.fixture(autouse=True)
def mock_stripe_service(mocker: MockerFixture) -> MagicMock:
    """Mock Stripe service for e2e tests.

    Replaces the stripe_service singleton used by checkout (and other) services.
    Individual tests can configure return values on this mock as needed.
    """
    from tests.fixtures.stripe import construct_stripe_customer

    mock = MagicMock()
    mock.create_customer = mocker.AsyncMock(return_value=construct_stripe_customer())
    mock.update_customer = mocker.AsyncMock(return_value=construct_stripe_customer())
    mocker.patch("polar.checkout.service.stripe_service", new=mock)
    return mock


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
# Worker Middleware Patches (Step 3)
# =============================================================================


@pytest_asyncio.fixture
async def httpx_client() -> AsyncIterator[httpx.AsyncClient]:
    """HTTP client for external requests in tasks."""
    test_client = httpx.AsyncClient()
    yield test_client
    await test_client.aclose()


@pytest.fixture
def patch_worker_middlewares(
    mocker: MockerFixture,
    session: AsyncSession,
    redis: Redis,
    httpx_client: httpx.AsyncClient,
) -> None:
    """Patch worker middlewares to use test resources.

    Single injection point replacing the old 17-module AsyncSessionMaker patch.

    - SQLAlchemyMiddleware.get_async_session: returns the test session.
      AsyncSessionMaker() calls this at runtime (dynamic class method lookup),
      so patching it once affects ALL task modules automatically.
      The test session uses join_transaction_mode (bound to external connection),
      so session.commit() in AsyncSessionMaker operates on savepoints, not the
      outer test transaction.

    - RedisMiddleware.get: returns the real test Redis.

    - HTTPXMiddleware.get: returns the test httpx client.
    """

    @contextlib.asynccontextmanager
    async def _mock_get_async_session() -> AsyncIterator[AsyncSession]:
        yield session

    mocker.patch.object(
        SQLAlchemyMiddleware,
        "get_async_session",
        side_effect=_mock_get_async_session,
    )
    mocker.patch.object(RedisMiddleware, "get", return_value=redis)
    mocker.patch.object(HTTPXMiddleware, "get", return_value=httpx_client)


# =============================================================================
# Task Execution Fixtures (Step 2)
# =============================================================================


@pytest.fixture
def task_executor(redis: Redis) -> TaskExecutor:
    """Helper to execute pending tasks via real Redis transport."""
    return TaskExecutor(redis)


@pytest.fixture
def set_job_queue_manager() -> Iterator[JobQueueManager]:
    """Initialize the JobQueueManager context for the API request."""
    manager = JobQueueManager()
    _job_queue_manager.set(manager)
    yield manager
    _job_queue_manager.set(None)
