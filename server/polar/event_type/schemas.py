from datetime import datetime
from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field, field_validator

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.event import EventSource


class EventTypeUpdate(Schema):
    label: str = Field(
        ..., description="The label for the event type.", min_length=1, max_length=128
    )
    label_property_selector: str | None = Field(
        None,
        description="Property path to extract dynamic label from event metadata (e.g., 'subject' or 'metadata.subject').",
        min_length=1,
        max_length=256,
    )

    @field_validator("label")
    @classmethod
    def strip_and_validate_label(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Label cannot be empty or only whitespace")
        return v

    @field_validator("label_property_selector")
    @classmethod
    def strip_and_validate_label_property_selector(cls, v: str | None) -> str | None:
        if v is not None:
            v = v.strip()
            if not v:
                return None
        return v


class EventType(IDSchema, TimestampedSchema):
    name: str = Field(..., description="The name of the event type.")
    label: str = Field(..., description="The label for the event type.")
    label_property_selector: str | None = Field(
        None,
        description="Property path to extract dynamic label from event metadata.",
    )
    organization_id: UUID4 = Field(
        ..., description="The ID of the organization owning the event type."
    )


class EventTypeWithStats(EventType):
    source: EventSource = Field(
        description="The source of the events (system or user)."
    )
    occurrences: int = Field(description="Number of times the event has occurred.")
    first_seen: datetime = Field(description="The first time the event occurred.")
    last_seen: datetime = Field(description="The last time the event occurred.")


EventTypeID = Annotated[UUID4, Path(description="The event type ID.")]
