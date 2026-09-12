import httpx
import pytest
import respx
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
from polar.member.service import member_service
from polar.models import Organization
from polar.models.customer import CustomerType
from polar.models.member import MemberRole
from polar.models.webhook_endpoint import (
    WebhookEndpoint,
    WebhookEventType,
    WebhookFormat,
)
from polar.webhook.repository import WebhookDeliveryRepository
from polar.webhook.tasks import _webhook_event_send
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer, create_member


@pytest.mark.asyncio
class TestAddToCustomerLiveWebhookDelivery:
    """Live end-to-end: real ``webhook_service.send`` (NOT mocked) creates the
    ``WebhookEvent`` and enqueues ``webhook_event.send``; the real
    ``_webhook_event_send`` task then performs the HTTP POST (intercepted by
    respx). This exercises the full delivery pipeline for the fix."""

    async def test_new_member_member_created_delivered(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        respx_mock: respx.MockRouter,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.webhook.service.enqueue_job")
        respx_mock.post("https://example.com/hook").mock(
            return_value=httpx.Response(200, json={"status": "ok"})
        )

        customer = await create_customer(
            save_fixture, organization=organization, email="customer@example.com"
        )
        customer.type = CustomerType.team
        await save_fixture(customer)
        await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.owner,
            email="owner@example.com",
        )

        endpoint = WebhookEndpoint(
            url="https://example.com/hook",
            format=WebhookFormat.raw,
            organization_id=organization.id,
            secret="mysecret",
            events=[WebhookEventType.member_created],
        )
        await save_fixture(endpoint)

        member = await member_service.add_to_customer(
            session, customer, email="new@example.com", name="New Member"
        )

        enqueue_job_mock.assert_called_once()
        assert enqueue_job_mock.call_args.args[0] == "webhook_event.send"
        webhook_event_id = enqueue_job_mock.call_args.kwargs["webhook_event_id"]

        await _webhook_event_send(session=session, webhook_event_id=webhook_event_id)

        delivery_repository = WebhookDeliveryRepository.from_session(session)
        deliveries = await delivery_repository.get_all_by_event(webhook_event_id)
        assert len(deliveries) == 1
        assert deliveries[0].succeeded is True

    async def test_existing_member_no_webhook_event(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        respx_mock: respx.MockRouter,
    ) -> None:
        route = respx_mock.post("https://example.com/hook").mock(
            return_value=httpx.Response(200, json={"status": "ok"})
        )
        enqueue_job_mock = mocker.patch("polar.webhook.service.enqueue_job")

        customer = await create_customer(
            save_fixture, organization=organization, email="customer@example.com"
        )
        customer.type = CustomerType.team
        await save_fixture(customer)
        existing = await create_member(
            save_fixture,
            customer=customer,
            organization=organization,
            role=MemberRole.member,
            email="existing@example.com",
        )

        endpoint = WebhookEndpoint(
            url="https://example.com/hook",
            format=WebhookFormat.raw,
            organization_id=organization.id,
            secret="mysecret",
            events=[WebhookEventType.member_created],
        )
        await save_fixture(endpoint)

        member = await member_service.add_to_customer(
            session, customer, email="existing@example.com"
        )

        assert member.id == existing.id
        enqueue_job_mock.assert_not_called()
        assert route.called is False
