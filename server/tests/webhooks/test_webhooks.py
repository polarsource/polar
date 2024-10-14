from typing import cast

import httpx
import pytest
import respx
from arq import Retry
from pytest_mock import MockerFixture
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.kit.db.postgres import AsyncSession
from polar.models.organization import Organization
from polar.models.subscription import Subscription
from polar.models.webhook_endpoint import (
    WebhookEndpoint,
    WebhookEventType,
    WebhookFormat,
)
from polar.models.webhook_event import WebhookEvent
from polar.subscription.service import subscription as subscription_service
from polar.webhook.service import webhook as webhook_service
from polar.webhook.tasks import (
    MAX_RETRIES,
    _webhook_event_send,
    allowed_url,
    webhook_event_send,
)
from polar.worker import JobContext, PolarWorkerContext
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
async def test_webhook_send(
    session: AsyncSession,
    save_fixture: SaveFixture,
    mocker: MockerFixture,
    organization: Organization,
    subscription: Subscription,
) -> None:
    called = False

    def in_process_enqueue_job(name, *args, **kwargs) -> None:  # type: ignore  # noqa: E501
        nonlocal called
        if name == "webhook_event.send":
            called = True
            assert kwargs["webhook_event_id"]
            return
        raise Exception(f"unexpected job: {name}")

    mocker.patch("polar.webhook.service.enqueue_job", new=in_process_enqueue_job)

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
        events=[WebhookEventType.subscription_created],  # subscribe to event
    )
    await save_fixture(endpoint)

    # then
    session.expunge_all()

    # get full subscription, with relations
    full_sub = await subscription_service.get(session, subscription.id)
    assert full_sub

    await webhook_service.send(
        session, organization, (WebhookEventType.subscription_created, full_sub)
    )

    assert called


@pytest.mark.asyncio
async def test_webhook_send_not_subscribed_to_event(
    session: AsyncSession,
    save_fixture: SaveFixture,
    mocker: MockerFixture,
    organization: Organization,
    subscription: Subscription,
) -> None:
    called = False

    def in_process_enqueue_job(name, *args, **kwargs) -> None:  # type: ignore  # noqa: E501
        nonlocal called
        if name == "webhook_event.send":
            called = True
            assert kwargs["webhook_event_id"]
            return
        raise Exception(f"unexpected job: {name}")

    mocker.patch("polar.webhook.service.enqueue_job", new=in_process_enqueue_job)

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
        events=[],  # not subscribing
    )
    await save_fixture(endpoint)

    # then
    session.expunge_all()

    # get full subscription, with relations
    full_sub = await subscription_service.get(session, subscription.id)
    assert full_sub

    await webhook_service.send(
        session, organization, (WebhookEventType.subscription_created, full_sub)
    )

    assert called is False


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_webhook_delivery(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
    job_context: JobContext,
) -> None:
    respx_mock.post("https://example.com/hook").mock(return_value=httpx.Response(200))

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
    )
    await save_fixture(endpoint)

    event = WebhookEvent(webhook_endpoint_id=endpoint.id, payload='{"foo":"bar"}')
    await save_fixture(event)

    # then
    session.expunge_all()

    await webhook_event_send(
        job_context,
        webhook_event_id=event.id,
        polar_context=PolarWorkerContext(),
    )


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_webhook_delivery_500(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
    job_context: JobContext,
) -> None:
    respx_mock.post("https://example.com/hook").mock(return_value=httpx.Response(500))

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
    )
    await save_fixture(endpoint)

    event = WebhookEvent(webhook_endpoint_id=endpoint.id, payload='{"foo":"bar"}')
    await save_fixture(event)

    # then
    session.expunge_all()

    # failures
    for job_try in range(MAX_RETRIES):
        with pytest.raises(Retry):
            job_context["job_try"] = job_try
            await _webhook_event_send(
                session=session,
                ctx=job_context,
                webhook_event_id=event.id,
            )

    # does not raise on last attempt
    job_context["job_try"] = MAX_RETRIES + 1
    await _webhook_event_send(
        session=session,
        ctx=job_context,
        webhook_event_id=event.id,
    )


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_webhook_delivery_http_error(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
    job_context: JobContext,
) -> None:
    respx_mock.post("https://example.com/hook").mock(
        side_effect=httpx.HTTPError("ERROR")
    )

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
    )
    await save_fixture(endpoint)

    event = WebhookEvent(webhook_endpoint_id=endpoint.id, payload='{"foo":"bar"}')
    await save_fixture(event)

    # then
    session.expunge_all()

    # failures
    for job_try in range(MAX_RETRIES):
        with pytest.raises(Retry):
            job_context["job_try"] = job_try
            await _webhook_event_send(
                session=session,
                ctx=job_context,
                webhook_event_id=event.id,
            )

    # does not raise on last attempt
    job_context["job_try"] = MAX_RETRIES + 1
    await _webhook_event_send(
        session=session,
        ctx=job_context,
        webhook_event_id=event.id,
    )


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_webhook_standard_webhooks_compatible(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
    job_context: JobContext,
) -> None:
    secret = "mysecret"
    route_mock = respx_mock.post("https://example.com/hook").mock(
        return_value=httpx.Response(200)
    )

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret=secret,
    )
    await save_fixture(endpoint)

    event = WebhookEvent(webhook_endpoint_id=endpoint.id, payload='{"foo":"bar"}')
    await save_fixture(event)

    # then
    session.expunge_all()

    await _webhook_event_send(
        session=session,
        ctx=job_context,
        webhook_event_id=event.id,
    )

    # Check that the generated signature is correct
    request = route_mock.calls.last.request
    w = StandardWebhook(secret.encode("utf-8"))
    assert w.verify(request.content, cast(dict[str, str], request.headers)) is not None


@pytest.mark.asyncio
async def test_allowed_url() -> None:
    assert allowed_url("https://example.com/webhooks")
    assert allowed_url("https://example.com:5000/webhooks")
    assert allowed_url("http://example.com:5000/webhooks") is False  # http
    assert allowed_url("https://127.0.0.1:5000/webhooks") is False  # loopback
    assert allowed_url("https://::1/webhooks") is False  # loopback
    assert allowed_url("https://foo.invalid:5000/webhooks") is False  # does not resolve
