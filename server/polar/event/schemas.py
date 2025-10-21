from datetime import UTC, datetime
from typing import Annotated, Literal, NotRequired

from fastapi import Path
from pydantic import (
    UUID4,
    AfterValidator,
    AliasChoices,
    AwareDatetime,
    Discriminator,
    Field,
)
from pydantic.type_adapter import TypeAdapter
from typing_extensions import TypedDict

from polar.customer.schemas.customer import Customer
from polar.event.system import (
    BenefitGrantMetadata,
    MeterCreditedMetadata,
    MeterResetMetadata,
    SubscriptionCycledMetadata,
    SubscriptionProductUpdatedMetadata,
    SubscriptionRevokedMetadata,
)
from polar.event.system import SystemEvent as SystemEventEnum
from polar.kit.metadata import METADATA_DESCRIPTION, MetadataValue
from polar.kit.schemas import (
    ClassName,
    IDSchema,
    Schema,
    SetSchemaReference,
)
from polar.models.event import EventSource
from polar.organization.schemas import OrganizationID

_NAME_DESCRIPTION = "The name of the event."
_SOURCE_DESCRIPTION = (
    "The source of the event. "
    "`system` events are created by Polar. "
    "`user` events are the one you create through our ingestion API."
)


def default_timestamp_factory() -> datetime:
    return datetime.now(UTC)


def is_past_timestamp(timestamp: datetime) -> datetime:
    # Convert to UTC
    timestamp = timestamp.astimezone(UTC)
    if timestamp > datetime.now(UTC):
        raise ValueError("Timestamp must be in the past.")
    return timestamp


class CostMetadata(TypedDict):
    amount: Annotated[int, Field(description="The amount in cents.")]
    currency: Annotated[
        str,
        Field(
            pattern="usd",
            description="The currency. Currently, only `usd` is supported.",
        ),
    ]


class LLMMetadata(TypedDict):
    vendor: Annotated[str, Field(description="The vendor of the event.")]
    model: Annotated[str, Field(description="The model used for the event.")]
    prompt: Annotated[
        str | None,
        Field(default=None, description="The LLM prompt used for the event."),
    ]
    response: Annotated[
        str | None,
        Field(default=None, description="The LLM response used for the event."),
    ]
    input_tokens: Annotated[
        int,
        Field(description="The number of LLM input tokens used for the event."),
    ]
    cached_input_tokens: Annotated[
        NotRequired[int],
        Field(
            description="The number of LLM cached tokens that were used for the event.",
        ),
    ]
    output_tokens: Annotated[
        int,
        Field(description="The number of LLM output tokens used for the event."),
    ]
    total_tokens: Annotated[
        int,
        Field(description="The total number of LLM tokens used for the event."),
    ]



class EventMetadataInput(  # type: ignore[call-arg]
    TypedDict,
    total=False,
    extra_items=MetadataValue,
):
    _cost: CostMetadata
    _llm: LLMMetadata


def metadata_default_factory() -> EventMetadataInput:
    return {}


class EventCreateBase(Schema):
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
    metadata: EventMetadataInput = Field(
        description=METADATA_DESCRIPTION.format(
            heading=(
                "Key-value object allowing you to store additional information about the event. "
                "Some keys like `_llm` are structured data that are handled specially by Polar."
            )
        ),
        default_factory=metadata_default_factory,
        serialization_alias="user_metadata",
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


class BaseEvent(IDSchema):
    timestamp: datetime = Field(description="The timestamp of the event.")
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


class SystemEventBase(BaseEvent):
    """An event created by Polar."""

    source: Literal[EventSource.system] = Field(description=_SOURCE_DESCRIPTION)


class MeterCreditEvent(SystemEventBase):
    """An event created by Polar when credits are added to a customer meter."""

    name: Literal[SystemEventEnum.meter_credited] = Field(description=_NAME_DESCRIPTION)
    metadata: MeterCreditedMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class MeterResetEvent(SystemEventBase):
    """An event created by Polar when a customer meter is reset."""

    name: Literal[SystemEventEnum.meter_reset] = Field(description=_NAME_DESCRIPTION)
    metadata: MeterResetMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class BenefitGrantedEvent(SystemEventBase):
    """An event created by Polar when a benefit is granted to a customer."""

    name: Literal[SystemEventEnum.benefit_granted] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: BenefitGrantMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class BenefitCycledEvent(SystemEventBase):
    """An event created by Polar when a benefit is cycled."""

    name: Literal[SystemEventEnum.benefit_cycled] = Field(description=_NAME_DESCRIPTION)
    metadata: BenefitGrantMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class BenefitUpdatedEvent(SystemEventBase):
    """An event created by Polar when a benefit is updated."""

    name: Literal[SystemEventEnum.benefit_updated] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: BenefitGrantMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class BenefitRevokedEvent(SystemEventBase):
    """An event created by Polar when a benefit is revoked from a customer."""

    name: Literal[SystemEventEnum.benefit_revoked] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: BenefitGrantMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class SubscriptionCycledEvent(SystemEventBase):
    """An event created by Polar when a subscription is cycled."""

    name: Literal[SystemEventEnum.subscription_cycled] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: SubscriptionCycledMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class SubscriptionRevokedEvent(SystemEventBase):
    """An event created by Polar when a subscription is revoked from a customer."""

    name: Literal[SystemEventEnum.subscription_revoked] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: SubscriptionRevokedMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class SubscriptionProductUpdatedEvent(SystemEventBase):
    """An event created by Polar when a subscription changes the product."""

    name: Literal[SystemEventEnum.subscription_product_updated] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: SubscriptionProductUpdatedMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


SystemEvent = Annotated[
    MeterCreditEvent
    | MeterResetEvent
    | BenefitGrantedEvent
    | BenefitCycledEvent
    | BenefitUpdatedEvent
    | BenefitRevokedEvent
    | SubscriptionCycledEvent
    | SubscriptionRevokedEvent
    | SubscriptionProductUpdatedEvent,
    Discriminator("name"),
    SetSchemaReference("SystemEvent"),
    ClassName("SystemEvent"),
]


class EventMetadataOutput(  # type: ignore[call-arg]
    TypedDict,
    total=False,
    extra_items=str | int | float | bool,
):
    _cost: CostMetadata
    _llm: LLMMetadata


class UserEvent(BaseEvent):
    """An event you created through the ingestion API."""

    name: str = Field(description=_NAME_DESCRIPTION)
    source: Literal[EventSource.user] = Field(description=_SOURCE_DESCRIPTION)
    metadata: EventMetadataOutput = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


Event = Annotated[
    SystemEvent | UserEvent,
    Discriminator("source"),
    SetSchemaReference("Event"),
    ClassName("Event"),
]

EventTypeAdapter: TypeAdapter[Event] = TypeAdapter(Event)


class EventName(Schema):
    name: str = Field(description="The name of the event.")
    source: EventSource = Field(description=_SOURCE_DESCRIPTION)
    occurrences: int = Field(description="Number of times the event has occurred.")
    first_seen: datetime = Field(description="The first time the event occurred.")
    last_seen: datetime = Field(description="The last time the event occurred.")


EventID = Annotated[UUID4, Path(description="The event ID.")]
