import json
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

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

    def test_seed_makes_payloads_reproducible(self, organization: Organization) -> None:
        first = TriggerFixtures(organization, seed=7)
        second = TriggerFixtures(organization, seed=7)
        other_order = TriggerFixtures(organization, seed=7)
        different = TriggerFixtures(organization, seed=8)
        first.build(WebhookEventType.order_paid)
        second.build(WebhookEventType.order_paid)
        other_order.build(WebhookEventType.customer_seat_claimed)
        different.build(WebhookEventType.order_paid)

        assert first.order.id == second.order.id
        assert first.order.id != different.order.id
        assert first.customer.name == other_order.customer.name
        assert first.member.name == other_order.member.name

    def test_objects_are_consistent_with_each_other(
        self, organization: Organization
    ) -> None:
        fixtures = TriggerFixtures(organization, seed=1)
        order = json.loads(
            fixtures.build(WebhookEventType.order_paid).get_raw_payload()
        )["data"]

        assert order["customer_id"] == order["customer"]["id"]
        assert order["product_id"] == order["product"]["id"]
        assert order["subscription_id"] == order["subscription"]["id"]
        assert order["subscription"]["product_id"] == order["product_id"]
        assert order["subscription"]["amount"] == fixtures.price.price_amount
        assert order["net_amount"] == fixtures.price.price_amount
        assert order["product"]["organization_id"] == str(organization.id)

    @pytest.mark.parametrize(
        ("event", "check"),
        [
            (
                WebhookEventType.checkout_expired,
                lambda data, now: data.status == "expired" and data.expires_at < now,
            ),
            (
                WebhookEventType.order_refunded,
                lambda data, now: (
                    data.status == "refunded"
                    and data.refunded_amount == data.net_amount
                ),
            ),
            (
                WebhookEventType.subscription_canceled,
                lambda data, now: (
                    data.cancel_at_period_end
                    and data.ends_at == data.current_period_end
                ),
            ),
            (
                WebhookEventType.subscription_revoked,
                lambda data, now: data.status == "canceled" and data.ended_at == now,
            ),
            (
                WebhookEventType.subscription_past_due,
                lambda data, now: data.status == "past_due",
            ),
            (
                WebhookEventType.customer_seat_claimed,
                lambda data, now: data.status == "claimed" and data.claimed_at == now,
            ),
            (
                WebhookEventType.customer_seat_revoked,
                lambda data, now: data.status == "revoked" and data.revoked_at == now,
            ),
            (
                WebhookEventType.benefit_grant_revoked,
                lambda data, now: data.is_revoked,
            ),
        ],
    )
    def test_lifecycle_events_carry_the_matching_state(
        self,
        organization: Organization,
        event: WebhookEventType,
        check: Callable[[Any, datetime], bool],
    ) -> None:
        fixtures = TriggerFixtures(organization, seed=1)
        payload = fixtures.build(event)

        assert check(payload.data, fixtures.now)


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

    @pytest.mark.parametrize(
        "path",
        [
            "data.items.x.label",
            "data.items.5.label",
            "data.amount.cents",
            "type",
        ],
    )
    def test_rejects_invalid_paths_with_a_validation_error(self, path: str) -> None:
        payload = {"type": "order.paid", "data": {"amount": 1, "items": [{}]}}

        with pytest.raises(PolarRequestValidationError):
            apply_overrides(payload, {path: "x"})


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

    async def test_rejects_overrides_the_schema_would_drop(
        self, redis: Redis, organization: Organization
    ) -> None:
        with pytest.raises(PolarRequestValidationError) as error:
            await trigger_event(
                redis,
                organization,
                TriggerRequest(
                    event=WebhookEventType.order_paid,
                    overrides={"data.nonexistent": 5000},
                    deliver=False,
                ),
            )

        assert "data.nonexistent" in str(error.value.errors())

    async def test_allows_overrides_inside_free_form_metadata(
        self, redis: Redis, organization: Organization
    ) -> None:
        response = await trigger_event(
            redis,
            organization,
            TriggerRequest(
                event=WebhookEventType.order_paid,
                overrides={"data.metadata.plan": "pro"},
                deliver=False,
            ),
        )

        assert response.payload["data"]["metadata"] == {"plan": "pro"}

    async def test_response_payload_matches_what_is_delivered(
        self, redis: Redis, organization: Organization, mocker: MockerFixture
    ) -> None:
        publish = mocker.patch("polar.cli.service.publish_webhook_event")
        await mark_active(redis, organization.id)

        response = await trigger_event(
            redis,
            organization,
            TriggerRequest(
                event=WebhookEventType.order_paid,
                overrides={"data.subtotal_amount": "5000"},
            ),
        )

        assert response.payload["data"]["subtotal_amount"] == 5000
        assert response.payload == json.loads(publish.call_args.kwargs["payload"])

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
