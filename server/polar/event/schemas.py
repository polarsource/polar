from datetime import UTC, datetime
from typing import Annotated

from pydantic import UUID4, AfterValidator, AwareDatetime, Field

from polar.kit.metadata import MetadataInputMixin
from polar.kit.schemas import Schema
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
            "ID of the customer in your Polar organization "
            "associated with the event."
        )
    )


class EventCreateExternalCustomer(EventCreateBase):
    external_customer_id: str = Field(
        description="ID of the customer in your system associated with the event."
    )


EventCreate = EventCreateCustomer | EventCreateExternalCustomer


class EventsIngest(Schema):
    events: list[EventCreate] = Field(description="List of events to ingest.")
