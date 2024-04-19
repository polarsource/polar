import base64

import httpx
import pytest
import standardwebhooks
from arq import Retry
from pytest_mock import MockerFixture
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.kit.db.postgres import AsyncSession
from polar.models.organization import Organization
from polar.models.subscription import Subscription
from polar.models.webhook_endpoint import WebhookEndpoint
from polar.models.webhook_event import WebhookEvent
from polar.subscription.service.subscription import subscription as subscription_service
from polar.webhook.service import webhook_service
from polar.webhook.tasks import _webhook_event_send, webhook_event_send
from polar.webhook.webhooks import WebhookEventType
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
        url="https://test.example.com/hook",
        organization_id=organization.id,
        secret="mysecret",
        event_subscription_created=True,  # subscribe to event
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
        url="https://test.example.com/hook",
        organization_id=organization.id,
        secret="mysecret",
        event_subscription_created=False,  # not subscribing
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
    mocker: MockerFixture,
    organization: Organization,
    job_context: JobContext,
) -> None:
    def httpx_post(*args, **kwargs) -> httpx.Response:  # type: ignore  # noqa: E501
        return httpx.Response(
            status_code=200,
        )

    mocker.patch("httpx.post", new=httpx_post)

    endpoint = WebhookEndpoint(
        url="https://test.example.com/hook",
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
    mocker: MockerFixture,
    organization: Organization,
    job_context: JobContext,
) -> None:
    def httpx_post(*args, **kwargs) -> httpx.Response:  # type: ignore  # noqa: E501
        return httpx.Response(
            status_code=500,
        )

    mocker.patch("httpx.post", new=httpx_post)

    endpoint = WebhookEndpoint(
        url="https://test.example.com/hook",
        organization_id=organization.id,
        secret="mysecret",
    )
    await save_fixture(endpoint)

    event = WebhookEvent(webhook_endpoint_id=endpoint.id, payload='{"foo":"bar"}')
    await save_fixture(event)

    # then
    session.expunge_all()

    # fails 4 times
    for job_try in range(5):
        with pytest.raises(Retry):
            job_context["job_try"] = job_try
            await _webhook_event_send(
                session=session,
                ctx=job_context,
                webhook_event_id=event.id,
            )

    # does not raise on the 5th attempt
    job_context["job_try"] = 5
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
    mocker: MockerFixture,
    organization: Organization,
    job_context: JobContext,
) -> None:
    called = True

    def httpx_post(*args, **kwargs) -> httpx.Response:  # type: ignore  # noqa: E501
        nonlocal called
        called = True

        w = StandardWebhook(btoa("mysecret"))
        w.verify(kwargs["content"], kwargs["headers"])

        return httpx.Response(
            status_code=200,
        )

    mocker.patch("httpx.post", new=httpx_post)

    endpoint = WebhookEndpoint(
        url="https://test.example.com/hook",
        organization_id=organization.id,
        secret="mysecret",
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

    assert called


@pytest.mark.asyncio
@pytest.mark.http_auto_expunge
async def test_webhook_standard_webhooks_fails_unexpected_secret(
    session: AsyncSession,
    save_fixture: SaveFixture,
    mocker: MockerFixture,
    organization: Organization,
    job_context: JobContext,
) -> None:
    called = True

    def httpx_post(*args, **kwargs) -> httpx.Response:  # type: ignore  # noqa: E501
        nonlocal called
        called = True

        w = StandardWebhook(btoa("mysecret"))
        w.verify(kwargs["content"], kwargs["headers"])

        return httpx.Response(
            status_code=200,
        )

    mocker.patch("httpx.post", new=httpx_post)

    endpoint = WebhookEndpoint(
        url="https://test.example.com/hook",
        organization_id=organization.id,
        secret="not-mysecret",
    )
    await save_fixture(endpoint)

    event = WebhookEvent(webhook_endpoint_id=endpoint.id, payload='{"foo":"bar"}')
    await save_fixture(event)

    # then
    session.expunge_all()

    with pytest.raises(standardwebhooks.webhooks.WebhookVerificationError):
        await _webhook_event_send(
            session=session,
            ctx=job_context,
            webhook_event_id=event.id,
        )

    assert called


def btoa(a: str) -> str:
    return base64.b64encode(a.encode("utf-8")).decode("utf-8")
