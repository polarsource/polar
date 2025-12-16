from datetime import UTC, datetime
from decimal import Decimal
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
    CheckoutCreatedMetadata,
    CustomerCreatedMetadata,
    CustomerDeletedMetadata,
    CustomerUpdatedMetadata,
    MeterCreditedMetadata,
    MeterResetMetadata,
    OrderPaidMetadata,
    OrderRefundedMetadata,
    SubscriptionBillingPeriodUpdatedMetadata,
    SubscriptionCanceledMetadata,
    SubscriptionCreatedMetadata,
    SubscriptionCycledMetadata,
    SubscriptionProductUpdatedMetadata,
    SubscriptionRevokedMetadata,
    SubscriptionSeatsUpdatedMetadata,
    SubscriptionUncanceledMetadata,
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
    amount: Annotated[
        Decimal,
        Field(
            description="The amount in cents.",
            max_digits=17,
            decimal_places=12,
        ),
    ]
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
    external_id: str | None = Field(
        default=None,
        description=(
            "Your unique identifier for this event. "
            "Useful for deduplication and parent-child relationships."
        ),
    )
    parent_id: str | None = Field(
        default=None,
        description=(
            "The ID of the parent event. "
            "Can be either a Polar event ID (UUID) or an external event ID."
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
    duplicates: int = Field(
        default=0, description="Number of duplicate events skipped."
    )


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
    child_count: int = Field(
        default=0, description="Number of direct child events linked to this event."
    )
    parent_id: UUID4 | None = Field(
        default=None,
        description="The ID of the parent event.",
    )
    label: str = Field(description="Human readable label of the event type.")


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


class SubscriptionCreatedEvent(SystemEventBase):
    """An event created by Polar when a subscription is created."""

    name: Literal[SystemEventEnum.subscription_created] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: SubscriptionCreatedMetadata = Field(
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


class SubscriptionCanceledEvent(SystemEventBase):
    """An event created by Polar when a subscription is canceled."""

    name: Literal[SystemEventEnum.subscription_canceled] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: SubscriptionCanceledMetadata = Field(
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


class SubscriptionUncanceledEvent(SystemEventBase):
    """An event created by Polar when a subscription cancellation is reversed."""

    name: Literal[SystemEventEnum.subscription_uncanceled] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: SubscriptionUncanceledMetadata = Field(
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


class SubscriptionSeatsUpdatedEvent(SystemEventBase):
    """An event created by Polar when a the seats on a subscription is changed."""

    name: Literal[SystemEventEnum.subscription_seats_updated] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: SubscriptionSeatsUpdatedMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class SubscriptionBillingPeriodUpdatedEvent(SystemEventBase):
    """An event created by Polar when a subscription billing period is updated."""

    name: Literal[SystemEventEnum.subscription_billing_period_updated] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: SubscriptionBillingPeriodUpdatedMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class OrderPaidEvent(SystemEventBase):
    """An event created by Polar when an order is paid."""

    name: Literal[SystemEventEnum.order_paid] = Field(description=_NAME_DESCRIPTION)
    metadata: OrderPaidMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class CustomerCreatedEvent(SystemEventBase):
    """An event created by Polar when a customer is created."""

    name: Literal[SystemEventEnum.customer_created] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: CustomerCreatedMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class OrderRefundedEvent(SystemEventBase):
    """An event created by Polar when an order is refunded."""

    name: Literal[SystemEventEnum.order_refunded] = Field(description=_NAME_DESCRIPTION)
    metadata: OrderRefundedMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class CheckoutCreatedEvent(SystemEventBase):
    """An event created by Polar when a checkout is created."""

    name: Literal[SystemEventEnum.checkout_created] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: CheckoutCreatedMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class CustomerUpdatedEvent(SystemEventBase):
    """An event created by Polar when a customer is updated."""

    name: Literal[SystemEventEnum.customer_updated] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: CustomerUpdatedMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


class CustomerDeletedEvent(SystemEventBase):
    """An event created by Polar when a customer is deleted."""

    name: Literal[SystemEventEnum.customer_deleted] = Field(
        description=_NAME_DESCRIPTION
    )
    metadata: CustomerDeletedMetadata = Field(
        validation_alias=AliasChoices("user_metadata", "metadata")
    )


SystemEvent = Annotated[
    MeterCreditEvent
    | MeterResetEvent
    | BenefitGrantedEvent
    | BenefitCycledEvent
    | BenefitUpdatedEvent
    | BenefitRevokedEvent
    | SubscriptionCreatedEvent
    | SubscriptionCycledEvent
    | SubscriptionCanceledEvent
    | SubscriptionRevokedEvent
    | SubscriptionUncanceledEvent
    | SubscriptionProductUpdatedEvent
    | SubscriptionSeatsUpdatedEvent
    | SubscriptionBillingPeriodUpdatedEvent
    | OrderPaidEvent
    | OrderRefundedEvent
    | CheckoutCreatedEvent
    | CustomerCreatedEvent
    | CustomerUpdatedEvent
    | CustomerDeletedEvent,
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


class EventAggregations(Schema):
    """Aggregated values from all descendant events."""

    descendant_count: int = Field(
        description="Total number of descendant events (not including the event itself)."
    )
    sums: dict[str, Decimal] = Field(
        description="Aggregated sums for requested metadata fields. Keys are field paths (e.g., 'cost_amount'), values are the summed totals.",
        default_factory=dict,
    )


class EventWithAggregations(Schema):
    """An event with aggregated values from its descendants."""

    event: Event = Field(description="The event.")
    aggregations: EventAggregations = Field(
        description="Aggregated values from all descendant events."
    )


class EventStatistics(Schema):
    """Aggregate statistics for events grouped by root event name."""

    name: str = Field(description="The name of the root event.")
    label: str = Field(description="The label of the event type.")
    event_type_id: UUID4 = Field(description="The ID of the event type")
    occurrences: int = Field(
        description="Number of root events with this name (i.e., number of traces)."
    )
    customers: int = Field(
        description="Number of distinct customers associated with events."
    )
    totals: dict[str, Decimal] = Field(
        description="Sum of each field across all events in all hierarchies.",
        default_factory=dict,
    )
    averages: dict[str, Decimal] = Field(
        description="Average of per-hierarchy totals (i.e., average cost per trace).",
        default_factory=dict,
    )
    p10: dict[str, Decimal] = Field(
        description="10th percentile of per-hierarchy totals.",
        default_factory=dict,
    )
    p90: dict[str, Decimal] = Field(
        description="90th percentile of per-hierarchy totals.",
        default_factory=dict,
    )
    p99: dict[str, Decimal] = Field(
        description="99th percentile of per-hierarchy totals.",
        default_factory=dict,
    )


class StatisticsPeriod(Schema):
    """Event statistics for a single time period."""

    timestamp: AwareDatetime = Field(description="Period timestamp")
    period_start: AwareDatetime = Field(description="Period start (inclusive)")
    period_end: AwareDatetime = Field(description="Period end (exclusive)")
    stats: list[EventStatistics] = Field(
        description="Stats grouped by event name for this period"
    )


class ListStatisticsTimeseries(Schema):
    """Event statistics timeseries."""

    periods: list[StatisticsPeriod] = Field(description="Stats for each time period.")
    totals: list[EventStatistics] = Field(
        description="Overall stats across all periods."
    )


EventID = Annotated[UUID4, Path(description="The event ID.")]
