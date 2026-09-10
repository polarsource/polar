import json
import uuid
from datetime import UTC, datetime

import pytest
from pytest_mock import MockerFixture

from polar.cli.fixtures import (
    SUPPORTED_EVENTS,
    TriggerFixtures,
    with_column_defaults,
)
from polar.cli.listener import mark_active
from polar.cli.schemas import TriggerRequest
from polar.cli.service import (
    NoActiveListener,
    apply_overrides,
    list_trigger_events,
    trigger_event,
)
from polar.exceptions import PolarRequestValidationError
from polar.models import Organization
from polar.models.organization import STATUS_CAPABILITIES, OrganizationStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.redis import Redis


@pytest.fixture
def organization() -> Organization:
    organization = with_column_defaults(
        Organization(
            id=uuid.uuid4(),
            created_at=datetime(2025, 7, 1, tzinfo=UTC),
            name="Acme Corp",
            slug="acme-corp",
            status=OrganizationStatus.ACTIVE,
            customer_invoice_prefix="ACME",
            avatar_url=None,
            account=None,
            payout_account=None,
        )
    )
    organization.capabilities = {**STATUS_CAPABILITIES[OrganizationStatus.ACTIVE]}
    return organization


class TestTriggerFixtures:
    @pytest.mark.parametrize("event", SUPPORTED_EVENTS)
    def test_builds_every_supported_event(
        self, organization: Organization, event: WebhookEventType
    ) -> None:
        payload = TriggerFixtures(organization, seed=1).build(event)

        assert payload.type == event
        raw = json.loads(payload.get_raw_payload())
        assert raw["type"] == event
        assert raw["data"]["id"]

    def test_seed_picks_the_same_people_regardless_of_build_order(
        self, organization: Organization
    ) -> None:
        first = TriggerFixtures(organization, seed=5)
        first.build(WebhookEventType.customer_seat_claimed)
        second = TriggerFixtures(organization, seed=5)
        second.build(WebhookEventType.customer_created)

        assert first.customer.name == second.customer.name
        assert first.member.name == second.member.name

    def test_seed_makes_generated_ids_reproducible(
        self, organization: Organization
    ) -> None:
        first = TriggerFixtures(organization, seed=7).build(WebhookEventType.order_paid)
        second = TriggerFixtures(organization, seed=7).build(
            WebhookEventType.order_paid
        )
        different = TriggerFixtures(organization, seed=8).build(
            WebhookEventType.order_paid
        )

        assert first.data.id == second.data.id
        assert first.data.id != different.data.id

    def test_objects_reference_each_other(self, organization: Organization) -> None:
        fixtures = TriggerFixtures(organization, seed=1)
        order = json.loads(
            fixtures.build(WebhookEventType.order_paid).get_raw_payload()
        )["data"]

        assert order["customer_id"] == order["customer"]["id"]
        assert order["product_id"] == order["product"]["id"]
        assert order["subscription_id"] == order["subscription"]["id"]
        assert order["subscription"]["product_id"] == order["product_id"]
        assert order["product"]["organization_id"] == str(organization.id)


def test_list_trigger_events_covers_every_event_type() -> None:
    events = list_trigger_events()

    assert {event.type for event in events} == set(WebhookEventType)
    assert all(event.description for event in events)


class TestApplyOverrides:
    def test_sets_nested_and_indexed_paths(self) -> None:
        payload = {"data": {"amount": 1, "items": [{"label": "a"}]}}

        apply_overrides(
            payload,
            {"data.amount": 2, "data.items.0.label": "b", "data.metadata.plan": "pro"},
        )

        assert payload == {
            "data": {
                "amount": 2,
                "items": [{"label": "b"}],
                "metadata": {"plan": "pro"},
            }
        }

    def test_rejects_paths_through_scalars(self) -> None:
        with pytest.raises(PolarRequestValidationError):
            apply_overrides({"data": {"amount": 1}}, {"data.amount.cents": 2})


@pytest.mark.asyncio
class TestTriggerEvent:
    async def test_requires_an_active_listener(
        self, redis: Redis, organization: Organization
    ) -> None:
        with pytest.raises(NoActiveListener):
            await trigger_event(
                redis,
                organization,
                TriggerRequest(event=WebhookEventType.order_created),
            )

    async def test_publishes_to_the_listener(
        self, redis: Redis, organization: Organization, mocker: MockerFixture
    ) -> None:
        publish = mocker.patch("polar.cli.service.publish_webhook_event")
        await mark_active(redis, organization.id)

        response = await trigger_event(
            redis,
            organization,
            TriggerRequest(
                event=WebhookEventType.order_paid,
                overrides={"data.customer.email": "vip@example.com"},
            ),
        )

        assert response.delivered is True
        assert response.payload["data"]["customer"]["email"] == "vip@example.com"
        publish.assert_called_once()
        kwargs = publish.call_args.kwargs
        assert kwargs["organization_id"] == organization.id
        assert kwargs["webhook_event_id"] == response.webhook_event_id
        assert kwargs["triggered"] is True
        assert json.loads(kwargs["payload"])["data"]["customer"]["email"] == (
            "vip@example.com"
        )

    async def test_skips_delivery_when_asked(
        self, redis: Redis, organization: Organization, mocker: MockerFixture
    ) -> None:
        publish = mocker.patch("polar.cli.service.publish_webhook_event")

        response = await trigger_event(
            redis,
            organization,
            TriggerRequest(event=WebhookEventType.subscription_active, deliver=False),
        )

        assert response.delivered is False
        assert response.payload["type"] == "subscription.active"
        publish.assert_not_called()

    async def test_rejects_overrides_that_break_the_schema(
        self, redis: Redis, organization: Organization
    ) -> None:
        with pytest.raises(PolarRequestValidationError):
            await trigger_event(
                redis,
                organization,
                TriggerRequest(
                    event=WebhookEventType.order_paid,
                    overrides={"data.subtotal_amount": "not-a-number"},
                    deliver=False,
                ),
            )
