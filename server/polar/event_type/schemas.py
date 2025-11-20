from typing import Annotated

from fastapi import Path
from pydantic import UUID4, Field, field_validator

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


class EventTypeUpdate(Schema):
    label: str = Field(
        ..., description="The label for the event type.", min_length=1, max_length=128
    )

    @field_validator("label")
    @classmethod
    def strip_and_validate_label(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Label cannot be empty or only whitespace")
        return v


class EventType(IDSchema, TimestampedSchema):
    name: str = Field(..., description="The name of the event type.")
    label: str = Field(..., description="The label for the event type.")
    organization_id: UUID4 = Field(
        ..., description="The ID of the organization owning the event type."
    )


EventTypeID = Annotated[UUID4, Path(description="The event type ID.")]
