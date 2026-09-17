from datetime import datetime
from uuid import UUID

from pydantic import Field

from polar.kit.email import EmailStrDNS
from polar.kit.schemas import IDSchema, Schema
from polar.void.entitlement.schemas import (
    EntitlementAssignmentRead,
    MeterEntitlementState,
)
from polar.void.meter.balance import MeterCycle, MeterEvent
from polar.void.meter.schemas import Meter, SubscriptionRead
from polar.void.reducer.schemas import Reducer
from polar.void.sense.schemas import CustomerSenseState


class CustomerCreate(Schema):
    external_id: str = Field(min_length=1, max_length=255, pattern=r"\S")
    email: EmailStrDNS
    name: str | None = Field(default=None, max_length=256)
    customer_id: UUID | None = Field(
        default=None,
        description="Existing Polar customer to bind. Its external ID must match or be unset.",
    )


class Customer(IDSchema):
    external_id: str
    email: str | None
    name: str | None
    created_at: datetime


class LedgerState(Schema):
    at: datetime | None
    subscription: SubscriptionRead | None
    boundary: datetime | None
    boundaries: list[datetime]
    cycles: dict[datetime, MeterCycle]
    credits: float
    usage: float
    remaining: float
    overage: float


class LastProcessedEvent(Schema):
    external_id: str
    timestamp: datetime
    ingested_at: datetime


class ProcessedEvent(LastProcessedEvent):
    event_ids: list[str] = Field(
        description="Exact events represented by this bucket result."
    )


class ReducerState(Schema):
    reducer_id: UUID
    external_identity_id: str | None
    bucket_start: datetime
    value: float | None
    last_processed_event: ProcessedEvent | None


class StateIdentity(Schema):
    external_id: str
    parent_external_id: str | None
    entitlements: EntitlementAssignmentRead


class MeterHolderState(Schema):
    external_identity_id: str
    balance: LedgerState
    base: LedgerState
    credit_base: float | None
    usage_base: float | None
    is_holder: bool
    events: list[MeterEvent]
    entitlement: MeterEntitlementState | None
    entitlement_usage_base: float = Field(
        description="Reduced usage from entitlement period start up to snapshot.since.",
    )


class CustomerMeterState(Schema):
    meter: Meter
    usage_last_processed_event: LastProcessedEvent | None
    credit_last_processed_event: LastProcessedEvent | None
    holders: list[MeterHolderState]


class CustomerState(Schema):
    organization_id: UUID
    customer: Customer
    at: datetime
    since: datetime
    next_change_at: datetime | None = Field(
        description="Next known billing boundary or subscription change."
    )
    identities: list[StateIdentity]
    meters: list[CustomerMeterState]
    reducers: list[Reducer]
    buckets: list[ReducerState]
    senses: list[CustomerSenseState] = Field(default_factory=list)
