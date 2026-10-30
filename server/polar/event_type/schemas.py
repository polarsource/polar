from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import Path
from pydantic import UUID4, Field, field_validator

from polar.customer.schemas.customer import CustomerID
from polar.kit.schemas import IDSchema, MultipleQueryFilter, Schema, TimestampedSchema
from polar.kit.versioning import QuerySchema
from polar.models.event import EventSource
from polar.organization.schemas import OrganizationID


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


class EventTypeWithStats(Schema):
    id: UUID4 | None = Field(
        None,
        description="The ID of the event type. Null for system event types.",
    )
    created_at: datetime | None = Field(
        None,
        description="Creation timestamp of the event type. Null for system event types.",
    )
    modified_at: datetime | None = Field(
        None,
        description="Last modification timestamp of the event type. Null for system event types.",
    )
    name: str = Field(..., description="The name of the event type.")
    label: str = Field(..., description="The label for the event type.")
    label_property_selector: str | None = Field(
        None,
        description="Property path to extract dynamic label from event metadata.",
    )
    organization_id: UUID4 = Field(
        ..., description="The ID of the organization owning the event type."
    )
    source: EventSource = Field(
        description="The source of the events (system or user)."
    )
    occurrences: int = Field(description="Number of times the event has occurred.")
    first_seen: datetime = Field(description="The first time the event occurred.")
    last_seen: datetime = Field(description="The last time the event occurred.")


EventTypeID = Annotated[UUID4, Path(description="The event type ID.")]


class EventTypeListParams(QuerySchema):
    organization_id: MultipleQueryFilter[OrganizationID] | None = Field(
        None, title="OrganizationID Filter", description="Filter by organization ID."
    )
    customer_id: MultipleQueryFilter[CustomerID] | None = Field(
        None, title="CustomerID Filter", description="Filter by customer ID."
    )
    external_customer_id: MultipleQueryFilter[str] | None = Field(
        None,
        title="ExternalCustomerID Filter",
        description="Filter by external customer ID.",
    )
    query: str | None = Field(
        None,
        title="Query",
        description="Query to filter event types by name or label.",
    )
    root_events: bool = Field(
        False,
        title="Root Events Filter",
        description="When true, only return event types with root events (parent_id IS NULL).",
    )
    parent_id: UUID | None = Field(
        None,
        title="ParentID Filter",
        description="Filter by specific parent event ID.",
    )
    source: EventSource | None = Field(
        None,
        title="EventSource Filter",
        description="Filter by event source (system or user).",
    )
