import base64
import json
import secrets
import uuid
from datetime import timedelta
from typing import Annotated, cast
from unittest.mock import MagicMock

import httpx
import pytest
import respx
from dramatiq import Retry
from pydantic import Field
from pytest_mock import MockerFixture
from standardwebhooks.webhooks import Webhook as StandardWebhook

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.schemas import IDSchema
from polar.kit.utils import utc_now
from polar.kit.versioning import Version
from polar.models.organization import Organization
from polar.models.subscription import Subscription
from polar.models.webhook_delivery import WebhookDelivery
from polar.models.webhook_endpoint import (
    WebhookEndpoint,
    WebhookEventType,
    WebhookFormat,
)
from polar.models.webhook_event import WebhookEvent
from polar.version import CURRENT_API_VERSION
from polar.webhook.constants import (
    WEBHOOK_SECRET_KEY_BYTES,
    WEBHOOK_SECRET_PREFIX,
    WEBHOOK_STANDARD_SIGNATURE_CUTOFF,
)
from polar.webhook.repository import WebhookDeliveryRepository
from polar.webhook.service import generate_webhook_secret
from polar.webhook.service import webhook as webhook_service
from polar.webhook.tasks import (
    _webhook_event_send,
    sign_webhook,
    uses_standard_webhook_signature,
    webhook_event_send,
)
from polar.webhook.webhooks import BaseWebhookPayload
from tests.fixtures.database import SaveFixture
from tests.kit.test_versioning import CURRENT_VERSION, NEXT_VERSION


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.webhook.service.enqueue_job")


def test_versioned_raw_payload() -> None:
    class VersionedProduct(IDSchema):
        name: str
        shared_field: Annotated[
            str, Version(starting_from=CURRENT_VERSION, up_to=NEXT_VERSION)
        ] = "shared"
        current_field: Annotated[str, Version(up_to=CURRENT_VERSION)] = "current"
        next_field: Annotated[
            str,
            Version(starting_from=NEXT_VERSION),
            Field(description="Only available in the next API version."),
        ] = "next"

    class VersionedWebhookPayload(BaseWebhookPayload):
        data: VersionedProduct

    current_payload = VersionedWebhookPayload(
        type=WebhookEventType.product_created,
        timestamp=utc_now(),
        api_version=CURRENT_VERSION,
        data=VersionedProduct(id=uuid.uuid4(), name="Test Product"),
    )
    current_payload_data = json.loads(current_payload.get_raw_payload())
    assert "shared_field" in current_payload_data["data"]
    assert "current_field" in current_payload_data["data"]
    assert "next_field" not in current_payload_data["data"]

    next_payload = VersionedWebhookPayload(
        type=WebhookEventType.product_created,
        timestamp=utc_now(),
        api_version=NEXT_VERSION,
        data=VersionedProduct(id=uuid.uuid4(), name="Test Product"),
    )
    next_payload_data = json.loads(next_payload.get_raw_payload())
    assert "shared_field" in next_payload_data["data"]
    assert "current_field" not in next_payload_data["data"]
    assert "next_field" in next_payload_data["data"]


class TestUsesStandardWebhookSignature:
    def test_none_keeps_legacy(self) -> None:
        assert uses_standard_webhook_signature(None) is False

    def test_before_cutoff_keeps_legacy(self) -> None:
        assert (
            uses_standard_webhook_signature(
                WEBHOOK_STANDARD_SIGNATURE_CUTOFF - timedelta(microseconds=1)
            )
            is False
        )

    def test_at_or_after_cutoff_uses_spec(self) -> None:
        assert (
            uses_standard_webhook_signature(WEBHOOK_STANDARD_SIGNATURE_CUTOFF) is True
        )
        assert (
            uses_standard_webhook_signature(
                WEBHOOK_STANDARD_SIGNATURE_CUTOFF + timedelta(days=1)
            )
            is True
        )


class TestGenerateWebhookSecret:
    def test_always_prefixed(self) -> None:
        secret = generate_webhook_secret()
        assert secret.startswith(WEBHOOK_SECRET_PREFIX)

    def test_spec_format_after_cutoff(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from polar.webhook import service

        monkeypatch.setattr(
            service,
            "utc_now",
            lambda: WEBHOOK_STANDARD_SIGNATURE_CUTOFF + timedelta(seconds=1),
        )
        secret = generate_webhook_secret()
        remainder = secret.removeprefix(WEBHOOK_SECRET_PREFIX)
        decoded = base64.b64decode(remainder)
        assert len(decoded) == WEBHOOK_SECRET_KEY_BYTES

    def test_polar_token_before_cutoff(self, monkeypatch: pytest.MonkeyPatch) -> None:
        from polar.webhook import service

        monkeypatch.setattr(
            service,
            "utc_now",
            lambda: WEBHOOK_STANDARD_SIGNATURE_CUTOFF - timedelta(seconds=1),
        )
        secret = generate_webhook_secret()
        remainder = secret.removeprefix(WEBHOOK_SECRET_PREFIX)
        assert len(remainder) == 43


class TestSignWebhook:
    def test_legacy_matches_utf8_hmac(self) -> None:
        secret = "whsec_legacyPolarToken"
        payload = '{"foo":"bar"}'
        timestamp = utc_now()
        signature = sign_webhook(
            secret,
            "msg_1",
            timestamp,
            payload,
            secret_generated_at=None,
        )
        StandardWebhook(secret.encode("utf-8")).verify(
            payload.encode(),
            {
                "webhook-id": "msg_1",
                "webhook-timestamp": str(int(timestamp.timestamp())),
                "webhook-signature": signature,
            },
        )

    def test_before_cutoff_stays_legacy_even_when_stamped(self) -> None:
        secret = "whsec_legacyPolarToken"
        payload = '{"foo":"bar"}'
        timestamp = utc_now()
        signature = sign_webhook(
            secret,
            "msg_1",
            timestamp,
            payload,
            secret_generated_at=WEBHOOK_STANDARD_SIGNATURE_CUTOFF
            - timedelta(microseconds=1),
        )
        StandardWebhook(secret.encode("utf-8")).verify(
            payload.encode(),
            {
                "webhook-id": "msg_1",
                "webhook-timestamp": str(int(timestamp.timestamp())),
                "webhook-signature": signature,
            },
        )

    def test_spec_matches_standard_webhooks_library(self) -> None:
        key = secrets.token_bytes(WEBHOOK_SECRET_KEY_BYTES)
        secret = f"{WEBHOOK_SECRET_PREFIX}{base64.b64encode(key).decode()}"
        payload = '{"foo":"bar"}'
        timestamp = utc_now()
        signature = sign_webhook(
            secret,
            "msg_1",
            timestamp,
            payload,
            secret_generated_at=WEBHOOK_STANDARD_SIGNATURE_CUTOFF,
        )
        StandardWebhook(secret).verify(
            payload.encode(),
            {
                "webhook-id": "msg_1",
                "webhook-timestamp": str(int(timestamp.timestamp())),
                "webhook-signature": signature,
            },
        )


@pytest.mark.asyncio
async def test_webhook_send(
    session: AsyncSession,
    save_fixture: SaveFixture,
    enqueue_job_mock: MagicMock,
    organization: Organization,
    subscription: Subscription,
) -> None:
    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
        events=[WebhookEventType.subscription_created],  # subscribe to event
    )
    await save_fixture(endpoint)

    events = await webhook_service.send(
        session, organization, WebhookEventType.subscription_created, subscription
    )
    assert len(events) == 1

    event = events[0]
    assert event.webhook_endpoint == endpoint

    enqueue_job_mock.assert_called_once_with(
        "webhook_event.send", webhook_event_id=event.id
    )


@pytest.mark.asyncio
async def test_webhook_send_not_subscribed_to_event(
    session: AsyncSession,
    save_fixture: SaveFixture,
    enqueue_job_mock: MagicMock,
    organization: Organization,
    subscription: Subscription,
) -> None:
    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
        events=[],  # not subscribing
    )
    await save_fixture(endpoint)

    events = await webhook_service.send(
        session, organization, WebhookEventType.subscription_created, subscription
    )

    assert len(events) == 0
    enqueue_job_mock.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("response", "expected"),
    [
        (httpx.Response(200, json={"status": "ok"}), '{"status":"ok"}'),
        (httpx.Response(200), None),
        pytest.param(
            httpx.Response(200, text="a" * 8192),
            "a" * 2048,
            id="long response that is truncated",
        ),
        pytest.param(
            httpx.Response(200, content=b"foo\x00bar"),
            "foobar",
            id="response with null bytes",
        ),
    ],
)
async def test_webhook_delivery_success(
    response: httpx.Response,
    expected: str,
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
) -> None:
    respx_mock.post("https://example.com/hook").mock(return_value=response)

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
    )
    await save_fixture(endpoint)

    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        type=WebhookEventType.customer_created,
        api_version=CURRENT_API_VERSION,
        payload='{"foo":"bar"}',
    )
    await save_fixture(event)

    await webhook_event_send(webhook_event_id=event.id)

    delivery_repository = WebhookDeliveryRepository.from_session(session)
    deliveries = await delivery_repository.get_all_by_event(event.id)
    assert len(deliveries) == 1
    delivery = deliveries[0]
    assert delivery.succeeded is True
    assert delivery.response == expected


@pytest.mark.asyncio
async def test_webhook_delivery_500(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
) -> None:
    respx_mock.post("https://example.com/hook").mock(
        return_value=httpx.Response(500, text="Internal Error")
    )

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret="mysecret",
    )
    await save_fixture(endpoint)

    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        type=WebhookEventType.customer_created,
        api_version=CURRENT_API_VERSION,
        payload='{"foo":"bar"}',
    )
    await save_fixture(event)

    # First attempt: should retry
    with pytest.raises(Retry):
        await _webhook_event_send(session=session, webhook_event_id=event.id)

    # Simulate enough prior failed deliveries to reach the max.
    # The first call already committed 1 delivery, so add enough to make the
    # next attempt see delivery_count >= WEBHOOK_MAX_RETRIES.
    for _ in range(settings.WEBHOOK_MAX_RETRIES - 2):
        await save_fixture(
            WebhookDelivery(
                webhook_event_id=event.id,
                webhook_endpoint_id=endpoint.id,
                succeeded=False,
            )
        )

    # Last attempt: does not raise, records permanent failure
    await _webhook_event_send(session=session, webhook_event_id=event.id)

    delivery_repository = WebhookDeliveryRepository.from_session(session)
    deliveries = await delivery_repository.get_all_by_event(event.id)

    assert len(deliveries) == settings.WEBHOOK_MAX_RETRIES
    for delivery in deliveries:
        assert delivery.succeeded is False


@pytest.mark.asyncio
async def test_webhook_delivery_http_error(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
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

    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        type=WebhookEventType.customer_created,
        api_version=CURRENT_API_VERSION,
        payload='{"foo":"bar"}',
    )
    await save_fixture(event)

    # First attempt: should retry
    with pytest.raises(Retry):
        await _webhook_event_send(session=session, webhook_event_id=event.id)

    # Simulate enough prior failed deliveries to reach the max
    for _ in range(settings.WEBHOOK_MAX_RETRIES - 2):
        await save_fixture(
            WebhookDelivery(
                webhook_event_id=event.id,
                webhook_endpoint_id=endpoint.id,
                succeeded=False,
            )
        )

    # Last attempt: does not raise, records permanent failure
    await _webhook_event_send(session=session, webhook_event_id=event.id)

    delivery_repository = WebhookDeliveryRepository.from_session(session)
    deliveries = await delivery_repository.get_all_by_event(event.id)
    assert len(deliveries) == settings.WEBHOOK_MAX_RETRIES
    for delivery in deliveries:
        assert delivery.succeeded is False


@pytest.mark.asyncio
async def test_webhook_standard_webhooks_compatible(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
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

    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        type=WebhookEventType.customer_created,
        api_version=CURRENT_API_VERSION,
        payload='{"foo":"bar"}',
    )
    await save_fixture(event)

    await _webhook_event_send(session=session, webhook_event_id=event.id)

    # Check that the generated signature is correct
    request = route_mock.calls.last.request
    w = StandardWebhook(secret.encode("utf-8"))
    assert w.verify(request.content, cast(dict[str, str], request.headers)) is not None


@pytest.mark.asyncio
async def test_webhook_legacy_signature_when_secret_generated_before_cutoff(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
) -> None:
    secret = "whsec_postColumnButPreSpec"
    route_mock = respx_mock.post("https://example.com/hook").mock(
        return_value=httpx.Response(200)
    )

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret=secret,
        secret_generated_at=WEBHOOK_STANDARD_SIGNATURE_CUTOFF - timedelta(days=1),
    )
    await save_fixture(endpoint)

    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        type=WebhookEventType.customer_created,
        api_version=CURRENT_API_VERSION,
        payload='{"foo":"bar"}',
    )
    await save_fixture(event)

    await _webhook_event_send(session=session, webhook_event_id=event.id)

    request = route_mock.calls.last.request
    w = StandardWebhook(secret.encode("utf-8"))
    assert w.verify(request.content, cast(dict[str, str], request.headers)) is not None


@pytest.mark.asyncio
async def test_webhook_spec_signature_when_secret_generated_at_cutoff(
    session: AsyncSession,
    save_fixture: SaveFixture,
    respx_mock: respx.MockRouter,
    organization: Organization,
) -> None:
    key = secrets.token_bytes(WEBHOOK_SECRET_KEY_BYTES)
    secret = f"{WEBHOOK_SECRET_PREFIX}{base64.b64encode(key).decode()}"
    route_mock = respx_mock.post("https://example.com/hook").mock(
        return_value=httpx.Response(200)
    )

    endpoint = WebhookEndpoint(
        url="https://example.com/hook",
        format=WebhookFormat.raw,
        organization_id=organization.id,
        secret=secret,
        secret_generated_at=WEBHOOK_STANDARD_SIGNATURE_CUTOFF,
    )
    await save_fixture(endpoint)

    event = WebhookEvent(
        webhook_endpoint_id=endpoint.id,
        type=WebhookEventType.customer_created,
        api_version=CURRENT_API_VERSION,
        payload='{"foo":"bar"}',
    )
    await save_fixture(event)

    await _webhook_event_send(session=session, webhook_event_id=event.id)

    request = route_mock.calls.last.request
    w = StandardWebhook(secret)
    assert w.verify(request.content, cast(dict[str, str], request.headers)) is not None
