import uuid
from datetime import UTC, datetime

from polar.integrations.tinybird.service import _event_to_tinybird
from polar.models import Event
from polar.models.event import EventSource


def create_test_event(
    *,
    organization_id: uuid.UUID | None = None,
    name: str = "test.event",
    source: EventSource = EventSource.system,
    user_metadata: dict[str, object] | None = None,
) -> Event:
    """Create an Event object for testing (not persisted to DB)."""
    now = datetime.now(UTC)
    event = Event(
        id=uuid.uuid4(),
        ingested_at=now,
        timestamp=now,
        name=name,
        source=source,
        organization_id=organization_id or uuid.uuid4(),
        user_metadata=user_metadata or {},
    )
    return event


class TestEventToTinybird:
    def test_basic_conversion(self) -> None:
        event = create_test_event(name="order.paid")
        result = _event_to_tinybird(event)

        assert result["id"] == str(event.id)
        assert result["name"] == "order.paid"
        assert result["source"] == "system"
        assert result["organization_id"] == str(event.organization_id)
        assert result["user_metadata"] == "{}"

    def test_with_metadata_fields(self) -> None:
        event = create_test_event(
            name="order.paid",
            user_metadata={
                "amount": 1000,
                "currency": "usd",
                "order_id": "order_123",
            },
        )
        result = _event_to_tinybird(event)

        assert result["amount"] == 1000
        assert result["currency"] == "usd"
        assert result["order_id"] == "order_123"

    def test_with_cost_metadata(self) -> None:
        event = create_test_event(
            name="llm.request",
            source=EventSource.user,
            user_metadata={
                "_cost": {"amount": 0.05, "currency": "usd"},
                "_llm": {
                    "vendor": "openai",
                    "model": "gpt-4",
                    "input_tokens": 100,
                    "output_tokens": 50,
                },
            },
        )
        result = _event_to_tinybird(event)

        assert result["source"] == "user"
        assert result["cost_amount"] == 0.05
        assert result["cost_currency"] == "usd"
        assert result["llm_vendor"] == "openai"
        assert result["llm_model"] == "gpt-4"
        assert result["llm_input_tokens"] == 100
        assert result["llm_output_tokens"] == 50

    def test_nullable_fields_are_none(self) -> None:
        event = create_test_event()
        result = _event_to_tinybird(event)

        assert result["customer_id"] is None
        assert result["external_customer_id"] is None
        assert result["parent_id"] is None
        assert result["meter_id"] is None
        assert result["amount"] is None
