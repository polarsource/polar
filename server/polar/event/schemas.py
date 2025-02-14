from datetime import UTC, datetime
from typing import Annotated

from fastapi import Path
from pydantic import UUID4, AfterValidator, AwareDatetime, Field

from polar.customer.schemas import Customer
from polar.kit.metadata import MetadataInputMixin, MetadataOutputMixin
from polar.kit.schemas import IDSchema, Schema
from polar.models.event import EventSource
from polar.organization.schemas import OrganizationID


def default_timestamp_factory() -> datetime:
    return datetime.now(UTC)


def is_past_timestamp(timestamp: datetime) -> datetime:
    # Convert to UTC
    timestamp = timestamp.astimezone(UTC)
    if timestamp > datetime.now(UTC):
        raise ValueError("Timestamp must be in the past.")
    return timestamp


class EventCreateBase(Schema, MetadataInputMixin):
    timestamp: Annotated[
        AwareDatetime,
        AfterValidator(is_past_timestamp),
    ] = Field(
        default_factory=default_timestamp_factory,
        description="The timestamp of the event.",
    )
    name: str = Field(..., description="The name of the event.")
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the event. "
            "**Required unless you use an organization token.**"
        ),
    )


class EventCreateCustomer(EventCreateBase):
    customer_id: UUID4 = Field(
        description=(
            "ID of the customer in your Polar organization associated with the event."
        )
    )


class EventCreateExternalCustomer(EventCreateBase):
    external_customer_id: str = Field(
        description="ID of the customer in your system associated with the event."
    )


EventCreate = EventCreateCustomer | EventCreateExternalCustomer


class EventsIngest(Schema):
    events: list[EventCreate] = Field(description="List of events to ingest.")


class EventsIngestResponse(Schema):
    inserted: int = Field(description="Number of events inserted.")


class Event(IDSchema, MetadataOutputMixin):
    timestamp: datetime = Field(description="The timestamp of the event.")
    name: str = Field(..., description="The name of the event.")
    source: EventSource = Field(
        ...,
        description=(
            "The source of the event. "
            "`system` events are created by Polar. "
            "`user` events are the one you create through our ingestion API."
        ),
    )
    organization_id: OrganizationID = Field(
        description="The ID of the organization owning the event."
    )
    customer_id: UUID4 | None = Field(
        description=(
            "ID of the customer in your Polar organization associated with the event."
        )
    )
    customer: Customer | None = Field(
        description="The customer associated with the event."
    )
    external_customer_id: str | None = Field(
        description="ID of the customer in your system associated with the event."
    )


EventID = Annotated[UUID4, Path(description="The event ID.")]
