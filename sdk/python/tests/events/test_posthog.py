import datetime
import decimal

import pytest

from polar.events import Event, PosthogDestination


@pytest.fixture
def destination() -> PosthogDestination:
    return PosthogDestination("phc_test", send=False)


def test_map_llm_generation(destination: PosthogDestination) -> None:
    occurred_at = datetime.datetime(2026, 7, 23, tzinfo=datetime.UTC)
    event_id = "6f9619ff-8b86-d011-b42d-00cf4fc964ff"
    event: Event = {
        "id": event_id,
        "name": "assistant.reply",
        "occurred_at": occurred_at,
        "account": "org_123",
        "actor": "user_123",
        "groups": {"workspace": "workspace_123"},
        "attributes": {"feature": "support_bot"},
        "parent_id": "span_parent",
        "cost": {
            "amount": decimal.Decimal("0.00042"),
            "currency": "USD",
        },
        "llm": {
            "kind": "generation",
            "provider": "openai",
            "model": "gpt-5-mini",
            "trace_id": "trace_123",
            "session_id": "conversation_123",
            "response_model": "gpt-5-mini-2026-06-01",
            "operation": "chat",
            "usage": {
                "input_tokens": 1200,
                "output_tokens": 180,
                "cache_read_input_tokens": 800,
                "cache_creation_input_tokens": 50,
                "reasoning_output_tokens": 100,
            },
            "input_messages": [{"role": "user", "content": "Hello"}],
            "output_messages": [{"role": "assistant", "content": "Hello!"}],
            "duration_seconds": 1.42,
            "time_to_first_token_seconds": 0.21,
            "stream": True,
            "http_status_code": 200,
            "finish_reason": "stop",
            "is_error": False,
        },
    }

    mapped_event = destination.map_event(event)

    assert mapped_event == {
        "event": "$ai_generation",
        "distinct_id": "user_123",
        "groups": {
            "account": "org_123",
            "workspace": "workspace_123",
        },
        "properties": {
            "$ai_cache_creation_input_tokens": 50,
            "$ai_cache_read_input_tokens": 800,
            "$ai_cache_reporting_exclusive": False,
            "$ai_http_status": 200,
            "$ai_input": [{"role": "user", "content": "Hello"}],
            "$ai_input_tokens": 1200,
            "$ai_is_error": False,
            "$ai_latency": 1.42,
            "$ai_model": "gpt-5-mini-2026-06-01",
            "$ai_output_choices": [{"role": "assistant", "content": "Hello!"}],
            "$ai_output_tokens": 180,
            "$ai_parent_id": "span_parent",
            "$ai_provider": "openai",
            "$ai_session_id": "conversation_123",
            "$ai_span_id": event_id,
            "$ai_span_name": "assistant.reply",
            "$ai_stop_reason": "stop",
            "$ai_stream": True,
            "$ai_time_to_first_token": 0.21,
            "$ai_total_cost_usd": 0.00042,
            "$ai_trace_id": "trace_123",
            "cost_amount": 0.00042,
            "cost_currency": "usd",
            "feature": "support_bot",
            "gen_ai.operation.name": "chat",
            "gen_ai.request.model": "gpt-5-mini",
            "gen_ai.usage.reasoning.output_tokens": 100,
        },
        "timestamp": occurred_at,
        "uuid": event_id,
    }


def test_map_account_event_without_actor(
    destination: PosthogDestination,
) -> None:
    event: Event = {
        "name": "invoice.generated",
        "account": "org_123",
        "parent_id": "invoice.requested",
    }

    mapped_event = destination.map_event(event)

    assert mapped_event == {
        "event": "invoice.generated",
        "distinct_id": "polar-account-events",
        "groups": {"account": "org_123"},
        "properties": {},
    }
