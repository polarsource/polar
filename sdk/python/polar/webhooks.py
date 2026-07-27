import base64
import binascii
import hashlib
import hmac
import json
import math
import time
import typing

from polar.base import PolarError

_WEBHOOK_TOLERANCE_SECONDS = 5 * 60
_PayloadT = typing.TypeVar("_PayloadT")


class PolarWebhookError(PolarError):
    """Base error raised while processing a Polar webhook."""


class PolarWebhookVerificationError(PolarWebhookError):
    """Raised when a Polar webhook signature cannot be verified."""


class PolarWebhookUnknownTypeError(PolarWebhookError):
    """Raised when a verified webhook type is unknown to this SDK version."""

    def __init__(self, event_type: str | None) -> None:
        self.event_type = event_type
        super().__init__(f"Unknown webhook event type: {event_type!r}")


def validate_event(
    body: str | bytes,
    headers: dict[str, str],
    secret: str,
    event_types: frozenset[str],
    payload_loader: typing.Callable[[dict[str, typing.Any]], _PayloadT],
) -> _PayloadT:
    """Verify a raw Polar webhook request and load its typed payload."""

    try:
        body_text = body.decode() if isinstance(body, bytes) else body
    except UnicodeDecodeError as e:
        raise PolarWebhookError("Failed to parse webhook payload") from e

    _verify_signature(body_text, headers, secret)

    try:
        data = json.loads(body_text)
    except (TypeError, ValueError) as e:
        raise PolarWebhookError("Failed to parse webhook payload") from e

    event_type = data.get("type") if isinstance(data, dict) else None
    if not isinstance(event_type, str) or event_type not in event_types:
        raise PolarWebhookUnknownTypeError(
            event_type if isinstance(event_type, str) else None
        )

    try:
        return payload_loader(data)
    except Exception as e:
        raise PolarWebhookError("Failed to parse webhook payload") from e


def _verify_signature(body: str, headers: dict[str, str], secret: str) -> None:
    if not secret:
        raise PolarWebhookVerificationError("Secret can't be empty")

    normalized_headers = {key.lower(): value for key, value in headers.items()}
    webhook_id = normalized_headers.get("webhook-id")
    webhook_timestamp = normalized_headers.get("webhook-timestamp")
    webhook_signature = normalized_headers.get("webhook-signature")
    if not webhook_id or not webhook_timestamp or not webhook_signature:
        raise PolarWebhookVerificationError("Missing required headers")

    try:
        timestamp = float(webhook_timestamp)
    except ValueError as e:
        raise PolarWebhookVerificationError("Invalid signature headers") from e
    if not math.isfinite(timestamp):
        raise PolarWebhookVerificationError("Invalid signature headers")

    now = time.time()
    if timestamp < now - _WEBHOOK_TOLERANCE_SECONDS:
        raise PolarWebhookVerificationError("Message timestamp too old")
    if timestamp > now + _WEBHOOK_TOLERANCE_SECONDS:
        raise PolarWebhookVerificationError("Message timestamp too new")

    signed_content = f"{webhook_id}.{math.floor(timestamp)}.{body}".encode()
    expected_signature = hmac.new(
        secret.encode(), signed_content, hashlib.sha256
    ).digest()

    for versioned_signature in webhook_signature.split():
        version, separator, signature = versioned_signature.partition(",")
        if version != "v1" or not separator:
            continue
        try:
            decoded_signature = base64.b64decode(signature, validate=True)
        except (binascii.Error, ValueError):
            continue
        if hmac.compare_digest(expected_signature, decoded_signature):
            return

    raise PolarWebhookVerificationError("No matching signature found")
