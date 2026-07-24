import datetime
import decimal
import typing

from polar.events import Event, PolarDestination
from polar.events.polar import EventServiceProtocol


class EventService:
    def ingest(self, **kwargs: typing.Any) -> None:
        pass


class PolarClient:
    def __init__(self) -> None:
        self.events: EventServiceProtocol = EventService()


def test_map_event() -> None:
    destination = PolarDestination(PolarClient())
    occurred_at = datetime.datetime(2026, 7, 23, tzinfo=datetime.UTC)
    event: Event = {
        "id": "event_123",
        "parent_id": "event_parent_123",
        "name": "assistant.reply",
        "occurred_at": occurred_at,
        "account": "org_123",
        "actor": "user_123",
        "attributes": {"feature": "support_bot"},
        "cost": {
            "amount": decimal.Decimal("0.00042"),
            "currency": "USD",
        },
        "llm": {
            "kind": "generation",
            "provider": "openai",
            "model": "gpt-5-mini",
            "trace_id": "trace_123",
            "usage": {
                "input_tokens": 1200,
                "output_tokens": 180,
                "cache_read_input_tokens": 800,
            },
        },
    }

    mapped_event = destination.map_event(event)

    assert mapped_event == {
        "name": "assistant.reply",
        "external_customer_id": "org_123",
        "external_id": "event_123",
        "parent_id": "event_parent_123",
        "timestamp": occurred_at.isoformat(),
        "external_member_id": "user_123",
        "metadata": {
            "feature": "support_bot",
            "_cost": {
                "amount": "0.04200",
                "currency": "usd",
            },
            "_llm": {
                "vendor": "openai",
                "model": "gpt-5-mini",
                "input_tokens": 1200,
                "output_tokens": 180,
                "total_tokens": 1380,
                "cached_input_tokens": 800,
            },
        },
    }
