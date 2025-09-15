import uuid
from typing import cast
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.checkout.eventstream import CheckoutEvent
from polar.exceptions import PolarRequestValidationError, ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import (
    Organization,
    Product,
    WebhookDelivery,
    WebhookEndpoint,
    WebhookEvent,
)
from polar.models.webhook_endpoint import WebhookEventType, WebhookFormat
from polar.postgres import AsyncSession
from polar.webhook.schemas import HttpsUrl, WebhookEndpointCreate, WebhookEndpointUpdate
from polar.webhook.service import EventDoesNotExist, EventNotSuccessul
from polar.webhook.service import webhook as webhook_service
from polar.webhook.webhooks import WebhookCheckoutUpdatedPayload
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.webhook.service.enqueue_job")


webhook_url = cast(HttpsUrl, "https://example.com/hook")


@pytest.mark.asyncio
class TestCreateEndpoint:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_set_organization_id(
        self, auth_subject: AuthSubject[Organization], session: AsyncSession
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url,
            format=WebhookFormat.raw,
            events=[],
            organization_id=uuid.uuid4(),
        )

        with pytest.raises(PolarRequestValidationError):
            await webhook_service.create_endpoint(session, auth_subject, create_schema)

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_valid(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        create_schema = WebhookEndpointCreate(
            url=webhook_url,
            format=WebhookFormat.raw,
            events=[],
            organization_id=None,
        )

        endpoint = await webhook_service.create_endpoint(
            session, auth_subject, create_schema
        )
        assert endpoint.organization == organization


@pytest.mark.asyncio
class TestUpdateEndpoint:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_endpoint_valid(
        self, session: AsyncSession, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        update_schema = WebhookEndpointUpdate(
            url=cast(HttpsUrl, "https://example.com/hook-updated")
        )

        updated_endpoint = await webhook_service.update_endpoint(
            session, endpoint=webhook_endpoint_organization, update_schema=update_schema
        )
        assert updated_endpoint.url == "https://example.com/hook-updated"


@pytest.mark.asyncio
class TestResetEndpointSecret:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_endpoint_valid(
        self, session: AsyncSession, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        old_secret = webhook_endpoint_organization.secret
        updated_endpoint = await webhook_service.reset_endpoint_secret(
            session, endpoint=webhook_endpoint_organization
        )
        assert updated_endpoint.secret != old_secret


@pytest.mark.asyncio
class TestDeleteEndpoint:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_endpoint_valid(
        self, session: AsyncSession, webhook_endpoint_organization: WebhookEndpoint
    ) -> None:
        deleted_endpoint = await webhook_service.delete_endpoint(
            session, webhook_endpoint_organization
        )
        assert deleted_endpoint.deleted_at is not None


@pytest.mark.asyncio
class TestRedeliverEvent:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization_second", scopes={Scope.webhooks_write})
    )
    async def test_organization_endpoint_not_admin(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        webhook_event_organization: WebhookEvent,
    ) -> None:
        with pytest.raises(ResourceNotFound):
            await webhook_service.redeliver_event(
                session, auth_subject, webhook_event_organization.id
            )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="organization", scopes={Scope.webhooks_write})
    )
    async def test_organization_endpoint_valid(
        self,
        auth_subject: AuthSubject[Organization],
        session: AsyncSession,
        webhook_event_organization: WebhookEvent,
        enqueue_job_mock: MagicMock,
    ) -> None:
        await webhook_service.redeliver_event(
            session, auth_subject, webhook_event_organization.id
        )
        enqueue_job_mock.assert_called_once()


@pytest.mark.asyncio
class TestOnEventSuccess:
    async def test_not_existing_event(self, session: AsyncSession) -> None:
        with pytest.raises(EventDoesNotExist):
            await webhook_service.on_event_success(session, uuid.uuid4())

    async def test_not_successful_event(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=False,
            type=WebhookEventType.checkout_updated,
            payload="{}",
        )
        await save_fixture(event)

        with pytest.raises(EventNotSuccessul):
            await webhook_service.on_event_success(session, event.id)

    async def test_checkout_updated_event(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        product: Product,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        publish_checkout_event_mock = mocker.patch(
            "polar.webhook.service.publish_checkout_event"
        )
        checkout = await create_checkout(save_fixture, products=[product])
        timestamp = utc_now()
        event = WebhookEvent(
            created_at=timestamp,
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=True,
            last_http_code=200,
            type=WebhookEventType.checkout_updated,
            payload=WebhookCheckoutUpdatedPayload.model_validate(
                {"type": "checkout.updated", "timestamp": timestamp, "data": checkout}
            ).model_dump_json(),
        )
        await save_fixture(event)

        await webhook_service.on_event_success(session, event.id)

        publish_checkout_event_mock.assert_called_once_with(
            checkout.client_secret,
            CheckoutEvent.webhook_event_delivered,
            {"status": checkout.status},
        )


@pytest.mark.asyncio
class TestIsLatestEvent:
    async def test_single_event(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=False,
            type=WebhookEventType.checkout_updated,
            payload="{}",
        )
        await save_fixture(event)

        assert await webhook_service.is_latest_event(session, event) is True

    async def test_delivered_previous_event(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        delivered_event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=True,
            last_http_code=200,
            type=WebhookEventType.checkout_updated,
            payload="{}",
        )
        await save_fixture(delivered_event)
        await save_fixture(
            WebhookDelivery(
                webhook_event=delivered_event,
                webhook_endpoint=webhook_endpoint_organization,
                succeeded=True,
                http_code=200,
            )
        )

        event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=False,
            type=WebhookEventType.checkout_updated,
            payload="{}",
        )
        await save_fixture(event)

        assert await webhook_service.is_latest_event(session, event) is True

    async def test_delivered_previous_event_no_http_code(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        delivered_event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=False,
            last_http_code=None,
            type=WebhookEventType.checkout_updated,
            payload="{}",
        )
        await save_fixture(delivered_event)
        await save_fixture(
            WebhookDelivery(
                webhook_event=delivered_event,
                webhook_endpoint=webhook_endpoint_organization,
                succeeded=False,
                http_code=None,
            )
        )

        event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=False,
            type=WebhookEventType.checkout_updated,
            payload="{}",
        )
        await save_fixture(event)

        assert await webhook_service.is_latest_event(session, event) is True

    async def test_undelivered_previous_event(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        previous_event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=False,
            last_http_code=None,
            type=WebhookEventType.checkout_updated,
            payload="{}",
        )
        await save_fixture(previous_event)

        event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=False,
            type=WebhookEventType.checkout_updated,
            payload="{}",
        )
        await save_fixture(event)

        assert await webhook_service.is_latest_event(session, event) is False

    async def test_undelivered_previous_event_old(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        webhook_endpoint_organization: WebhookEndpoint,
    ) -> None:
        previous_event = WebhookEvent(
            created_at=utc_now().replace(year=2000),
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=False,
            last_http_code=None,
            type=WebhookEventType.checkout_updated,
            payload="{}",
        )
        await save_fixture(previous_event)

        event = WebhookEvent(
            webhook_endpoint=webhook_endpoint_organization,
            succeeded=False,
            type=WebhookEventType.checkout_updated,
            payload="{}",
        )
        await save_fixture(event)

        assert await webhook_service.is_latest_event(session, event) is True
