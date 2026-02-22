import pytest
from pytest_mock import MockerFixture

from polar.customer.tasks import customer_webhook
from polar.models import Customer, Organization
from polar.models.webhook_endpoint import WebhookEventType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@pytest.mark.asyncio
class TestCustomerWebhook:
    async def test_customer_deleted_restores_external_id(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        """external_id is cleared in the DB on deletion for recycling purposes,
        but the webhook payload for customer.deleted should still carry it."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id="ext_123",
        )

        # Simulate what soft_delete does: clear external_id, stash it in user_metadata
        customer.user_metadata = {"__external_id": customer.external_id}
        customer.external_id = None
        await save_fixture(customer)

        webhook_mock = mocker.patch(
            "polar.customer.service.CustomerService.webhook",
            return_value=None,
        )

        await customer_webhook(WebhookEventType.customer_deleted, customer.id)

        webhook_mock.assert_called_once()
        called_customer: Customer = webhook_mock.call_args.args[3]
        assert called_customer.external_id == "ext_123"

    async def test_customer_deleted_without_external_id(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        mocker: MockerFixture,
    ) -> None:
        """Customers deleted without an external_id should not raise."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id=None,
        )

        customer.user_metadata = {}
        await save_fixture(customer)

        webhook_mock = mocker.patch(
            "polar.customer.service.CustomerService.webhook",
            return_value=None,
        )

        await customer_webhook(WebhookEventType.customer_deleted, customer.id)

        webhook_mock.assert_called_once()
        called_customer: Customer = webhook_mock.call_args.args[3]
        assert called_customer.external_id is None
