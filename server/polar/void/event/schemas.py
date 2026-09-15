import json
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import AwareDatetime, Field, field_validator

from polar.kit.schemas import Schema
from polar.kit.utils import utc_now


class EventSource(StrEnum):
    user = "user"
    system = "system"


class EventCreate(Schema):
    name: str = Field(min_length=1, max_length=255)
    external_id: str = Field(min_length=1, max_length=255)
    external_identity_id: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        description="An existing identity that performed the action. Usage rolls up to its root.",
    )
    timestamp: AwareDatetime = Field(
        default_factory=utc_now,
        description="Event time with timezone, from 1970-01-01 inclusive to 2106-01-01 exclusive.",
    )
    metadata: dict[str, Any] = Field(default_factory=dict)

    @field_validator("timestamp")
    @classmethod
    def supported_timestamp(cls, value: datetime) -> datetime:
        if (
            not datetime(1970, 1, 1, tzinfo=UTC)
            <= value
            < datetime(2106, 1, 1, tzinfo=UTC)
        ):
            raise ValueError("Event timestamp must be between 1970 and 2106")
        return value.astimezone(UTC)

    @field_validator("metadata")
    @classmethod
    def valid_json_metadata(cls, value: dict[str, Any]) -> dict[str, Any]:
        json.dumps(value, allow_nan=False)
        return value


class EventsIngestResponse(Schema):
    saved: int
    ignored: int


class Event(Schema):
    id: UUID
    timestamp: datetime
    name: str
    source: EventSource
    external_id: str
    external_identity_id: str | None
    external_root_id: str | None = Field(
        description="The actor's root, stamped when the event was accepted."
    )
    metadata: dict[str, Any]


class Pagination(Schema):
    total_count: int


class EventsList(Schema):
    items: list[Event]
    pagination: Pagination
