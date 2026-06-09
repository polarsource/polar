from datetime import UTC, datetime
from typing import Any

from polar_sdk.models import EventCreateCustomer, EventCreateExternalCustomer

MAX_NAME_LENGTH = 128

EventCreate = EventCreateCustomer | EventCreateExternalCustomer


def _error(
    error_type: str, index: int, field: str, value: Any, message: str
) -> dict[str, Any]:
    return {
        "type": error_type,
        "loc": ["body", "events", index, field],
        "msg": message,
        "input": value,
    }


def validate_event(index: int, event: EventCreate) -> list[dict[str, Any]]:
    """Mirror the stateless checks Polar applies at ingest, so poison events are
    rejected here instead of buffered and stuck at flush."""
    errors: list[dict[str, Any]] = []

    if not isinstance(event.external_id, str) or not event.external_id:
        errors.append(
            _error("missing", index, "external_id", None, "external_id is required.")
        )

    if isinstance(event.organization_id, str):
        errors.append(
            _error(
                "organization_token",
                index,
                "organization_id",
                event.organization_id,
                "Setting organization_id is disallowed when using an organization token.",
            )
        )

    if len(event.name) > MAX_NAME_LENGTH:
        errors.append(
            _error(
                "string_too_long",
                index,
                "name",
                event.name,
                f"String should have at most {MAX_NAME_LENGTH} characters.",
            )
        )

    if event.timestamp is not None:
        if event.timestamp.tzinfo is None:
            errors.append(
                _error(
                    "timezone_aware",
                    index,
                    "timestamp",
                    event.timestamp.isoformat(),
                    "Input should have timezone info.",
                )
            )
        elif event.timestamp.astimezone(UTC) > datetime.now(UTC):
            errors.append(
                _error(
                    "value_error",
                    index,
                    "timestamp",
                    event.timestamp.isoformat(),
                    "Timestamp must be in the past.",
                )
            )

    return errors
