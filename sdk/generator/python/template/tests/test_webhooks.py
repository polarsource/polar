import base64
import dataclasses
import datetime
import json
import typing

import pytest
from standardwebhooks.webhooks import Webhook

from polar.base import PolarError, deserialize
from polar.webhooks import (
    PolarWebhookError,
    PolarWebhookUnknownTypeError,
    PolarWebhookVerificationError,
    validate_event,
)

_SECRET = "test-secret"
_BASE64_SECRET = base64.b64encode(_SECRET.encode()).decode()
_EVENT_TYPE = "dummy.event"
_EVENT_TYPES = frozenset({_EVENT_TYPE})


@dataclasses.dataclass(kw_only=True, slots=True)
class DummyPayload:
    type: typing.Literal["dummy.event"]
    value: str


def _get_headers(
    body: str, timestamp: datetime.datetime | None = None
) -> dict[str, str]:
    timestamp = timestamp or datetime.datetime.now(tz=datetime.UTC)
    signature = Webhook(_BASE64_SECRET).sign("test-webhook", timestamp, body)
    return {
        "Webhook-Id": "test-webhook",
        "Webhook-Timestamp": str(int(timestamp.timestamp())),
        "Webhook-Signature": signature,
    }


def _load_payload(data: dict[str, typing.Any]) -> DummyPayload:
    return deserialize(data, DummyPayload)


def _validate_event(
    body: str | bytes, headers: dict[str, str], secret: str = _SECRET
) -> DummyPayload:
    return validate_event(body, headers, secret, _EVENT_TYPES, _load_payload)


@pytest.mark.parametrize("as_bytes", [False, True])
def test_validate_event(as_bytes: bool) -> None:
    body = json.dumps({"type": _EVENT_TYPE, "value": "payload"})
    raw_body = body.encode() if as_bytes else body

    assert _validate_event(raw_body, _get_headers(body)) == DummyPayload(
        type=_EVENT_TYPE, value="payload"
    )


def test_validate_event_rejects_invalid_signature() -> None:
    body = json.dumps({"type": _EVENT_TYPE, "value": "payload"})

    with pytest.raises(PolarWebhookVerificationError):
        _validate_event(body, _get_headers("{}"))


def test_validate_event_rejects_missing_headers() -> None:
    body = json.dumps({"type": _EVENT_TYPE, "value": "payload"})

    with pytest.raises(PolarWebhookVerificationError):
        _validate_event(body, {})


def test_validate_event_rejects_stale_timestamp() -> None:
    body = json.dumps({"type": _EVENT_TYPE, "value": "payload"})
    timestamp = datetime.datetime.now(tz=datetime.UTC) - datetime.timedelta(minutes=6)

    with pytest.raises(PolarWebhookVerificationError):
        _validate_event(body, _get_headers(body, timestamp))


def test_validate_event_rejects_unknown_type() -> None:
    body = json.dumps({"type": "future.event", "value": "payload"})

    with pytest.raises(PolarWebhookUnknownTypeError) as exception_info:
        _validate_event(body, _get_headers(body))

    assert exception_info.value.event_type == "future.event"


def test_validate_event_rejects_malformed_known_payload() -> None:
    body = json.dumps({"type": _EVENT_TYPE})

    with pytest.raises(PolarWebhookError):
        _validate_event(body, _get_headers(body))


def test_validate_event_rejects_malformed_json() -> None:
    body = "{"

    with pytest.raises(PolarWebhookError):
        _validate_event(body, _get_headers(body))


def test_webhook_error_hierarchy() -> None:
    assert issubclass(PolarWebhookError, PolarError)
    assert issubclass(PolarWebhookVerificationError, PolarWebhookError)
    assert issubclass(PolarWebhookUnknownTypeError, PolarWebhookError)
