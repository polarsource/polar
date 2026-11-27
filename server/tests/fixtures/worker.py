import importlib
import importlib.util
import ssl
from collections.abc import AsyncIterator, Iterator
from typing import Any
from unittest.mock import patch

import dramatiq
import httpx2
import pytest
from dramatiq.middleware.current_message import CurrentMessage

from polar.config import settings
from polar.worker import JobQueueManager, RedisMiddleware
from polar.worker._enqueue import _job_queue_manager
from polar.worker._httpx import HTTPXMiddleware
from polar.worker._sqlalchemy import SQLAlchemyMiddleware
from tests.fixtures.database import get_active_session, get_lazy_test_session
from tests.fixtures.redis import get_active_redis

_active_httpx_client: httpx2.AsyncClient | None = None
_shared_ssl_context: ssl.SSLContext | None = None


def _get_ssl_context() -> ssl.SSLContext:
    global _shared_ssl_context
    if _shared_ssl_context is None:
        _shared_ssl_context = httpx2.create_ssl_context()
    return _shared_ssl_context


def _get_active_httpx_client() -> httpx2.AsyncClient:
    global _active_httpx_client
    if _active_httpx_client is None:
        _active_httpx_client = httpx2.AsyncClient(verify=_get_ssl_context())
    return _active_httpx_client


def _get_test_async_session() -> Any:
    session = get_active_session()
    if session is None:
        return get_lazy_test_session()
    return session


_original_get_actor = dramatiq.Broker.get_actor

_ACTOR_PREFIX_MODULES: dict[str, str] = {
    "authentication_session": "polar.auth.tasks",
    "backoffice": "polar.backoffice.auth.tasks",
    "customer_session_authentication_session": "polar.customer_portal.tasks",
    "customer_session_email_otp": "polar.customer_portal.tasks",
    "email_log": "polar.email.tasks",
    "email_otp": "polar.auth.tasks",
    "oauth2_client": "polar.oauth2.tasks",
    "oauth2_state": "polar.auth.tasks",
    "oauth2_token": "polar.oauth2.tasks",
    "observability": "polar.observability.invariants.tasks",
    "polar_self": "polar.integrations.polar.tasks",
    "processor_fee": "polar.transaction.tasks",
    "reducer_bucket": "polar.reducer.tasks",
    "slo_report": "polar.observability.slo_report.tasks",
    "webhook_delivery": "polar.webhook.tasks",
    "webhook_event": "polar.webhook.tasks",
}


def _import_actor_module(actor_name: str) -> bool:
    prefix = actor_name.split(".", 1)[0]
    candidates: list[str] = []
    if mapped := _ACTOR_PREFIX_MODULES.get(prefix):
        candidates.append(mapped)
    elif prefix.isidentifier():
        candidates.extend(
            (f"polar.{prefix}.tasks", f"polar.integrations.{prefix}.tasks")
        )
    for module_name in candidates:
        try:
            spec = importlib.util.find_spec(module_name)
        except ModuleNotFoundError:
            continue
        if spec is not None:
            importlib.import_module(module_name)
            return True
    return False


def _get_actor_lazy(self: dramatiq.Broker, actor_name: str) -> dramatiq.Actor[Any, Any]:
    try:
        return _original_get_actor(self, actor_name)
    except dramatiq.ActorNotFound:
        if self is dramatiq.get_broker():
            if _import_actor_module(actor_name):
                try:
                    return _original_get_actor(self, actor_name)
                except dramatiq.ActorNotFound:
                    pass
            import polar.tasks  # noqa: F401

            return _original_get_actor(self, actor_name)
        raise


@pytest.fixture(scope="session", autouse=True)
def patch_worker_middlewares_session() -> Iterator[None]:
    with (
        patch.object(
            dramatiq.Broker,
            "get_actor",
            _get_actor_lazy,
        ),
        patch.object(
            SQLAlchemyMiddleware,
            "get_async_session",
            side_effect=_get_test_async_session,
        ),
        patch.object(
            RedisMiddleware,
            "get",
            side_effect=get_active_redis,
        ),
        patch.object(
            HTTPXMiddleware,
            "get",
            side_effect=_get_active_httpx_client,
        ),
    ):
        yield


@pytest.fixture(autouse=True)
def set_job_queue_manager_context() -> Iterator[JobQueueManager]:
    manager = JobQueueManager()
    token = _job_queue_manager.set(manager)
    yield manager
    _job_queue_manager.reset(token)


@pytest.fixture(scope="session")
def httpx_ssl_context() -> ssl.SSLContext:
    return _get_ssl_context()


@pytest.fixture
async def httpx_client(
    httpx_ssl_context: ssl.SSLContext,
) -> AsyncIterator[httpx2.AsyncClient]:
    global _active_httpx_client
    client = httpx2.AsyncClient(verify=httpx_ssl_context)
    previous = _active_httpx_client
    _active_httpx_client = client
    try:
        yield client
    finally:
        _active_httpx_client = previous
        await client.aclose()


@pytest.fixture(autouse=True)
async def patch_middlewares() -> AsyncIterator[None]:
    global _active_httpx_client
    _active_httpx_client = None
    yield
    client = _active_httpx_client
    _active_httpx_client = None
    if client is not None:
        await client.aclose()


@pytest.fixture(autouse=True)
def current_message() -> Iterator[dramatiq.Message[Any]]:
    message: dramatiq.Message[Any] = dramatiq.Message(
        queue_name="default",
        actor_name="actor",
        args=(),
        kwargs={},
        options={"retries": 0, "max_retries": settings.WORKER_MAX_RETRIES},
    )
    token = CurrentMessage._MESSAGE.set(message)
    yield message
    CurrentMessage._MESSAGE.reset(token)


@pytest.fixture(autouse=True)
async def worker_context(
    set_job_queue_manager_context: JobQueueManager | None,
    current_message: dramatiq.Message[Any] | None,
) -> AsyncIterator[None]:
    manager_token = _job_queue_manager.set(set_job_queue_manager_context)
    message_token = CurrentMessage._MESSAGE.set(current_message)
    yield
    CurrentMessage._MESSAGE.reset(message_token)
    _job_queue_manager.reset(manager_token)
