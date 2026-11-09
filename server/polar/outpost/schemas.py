import typing
from datetime import UTC, datetime

from pydantic import (
    UUID4,
    BeforeValidator,
    ConfigDict,
    Field,
    PlainSerializer,
)

from polar.kit.schemas import Schema
from polar.meter.aggregation import Aggregation
from polar.meter.filter import Filter
from polar.models.reducer import ReducerKind


def to_epoch_microseconds(value: datetime) -> int:
    # round absorbs the float error of timestamp()
    return round(value.timestamp() * 1_000_000)


def from_epoch_microseconds(value: typing.Any) -> typing.Any:
    if isinstance(value, int):
        try:
            return datetime.fromtimestamp(value / 1_000_000, UTC)
        except (OverflowError, OSError) as e:
            raise ValueError("Timestamp out of range") from e
    return value


# Microseconds since the Unix epoch, so clients compare integers.
type EpochMicroseconds = typing.Annotated[
    datetime,
    BeforeValidator(from_epoch_microseconds),
    PlainSerializer(to_epoch_microseconds, return_type=int),
]

CONFIRM_MAX_IDS = 1000
METER_USAGE_MAX_IDENTITIES = 500


class MeterUsageIncomingMessagePayloadBase(Schema):
    reducer_id: UUID4


class MeterUsageIncomingMessageCustomerPayload(MeterUsageIncomingMessagePayloadBase):
    customer_id: UUID4


class MeterUsageIncomingMessageExternalCustomerPayload(
    MeterUsageIncomingMessagePayloadBase
):
    external_customer_id: str


type MeterUsageIncomingMessagePayload = (
    MeterUsageIncomingMessageCustomerPayload
    | MeterUsageIncomingMessageExternalCustomerPayload
)


class MeterUsageIncomingPayload(Schema):
    identities: list[MeterUsageIncomingMessagePayload] = Field(
        min_length=1, max_length=METER_USAGE_MAX_IDENTITIES
    )


class ConfirmIncomingMessagePayloadBase(Schema):
    reducer_id: UUID4
    bucket_start: EpochMicroseconds
    ids: list[str] = Field(max_length=CONFIRM_MAX_IDS)


class ConfirmIncomingMessageCustomerPayload(ConfirmIncomingMessagePayloadBase):
    customer_id: UUID4


class ConfirmIncomingMessageExternalCustomerPayload(ConfirmIncomingMessagePayloadBase):
    external_customer_id: str


type ConfirmIncomingMessagePayload = (
    ConfirmIncomingMessageCustomerPayload
    | ConfirmIncomingMessageExternalCustomerPayload
)


class ConfigurationReducer(Schema):
    id: UUID4
    kind: ReducerKind
    filter: Filter
    aggregation: Aggregation
    meter_ids: list[UUID4]


class ConfigurationOutgoingMessagePayload(Schema):
    organization_id: UUID4
    reducers: list[ConfigurationReducer]


class MeterUsageOutgoingMessagePayload(Schema):
    reducer_id: UUID4
    # The bucket identity as events carry it: a customer can have several.
    customer_id: UUID4 | None
    external_customer_id: str | None
    customer_exists: bool
    # Database time of the read: keep the payload with the highest version.
    version: EpochMicroseconds
    # Usage before this is Polar's; Outpost counts its own from there on.
    cold_until: EpochMicroseconds
    count: int
    sum: float
    min: float | None
    max: float | None


class ConfirmedOutgoingMessagePayload(Schema):
    reducer_id: UUID4
    customer_id: UUID4 | None
    external_customer_id: str | None
    bucket_start: EpochMicroseconds
    # The requested ids the snapshot counts; the rest stay pending.
    ids: list[str]
    # Read in the same transaction as the ids, so the two agree.
    snapshot: MeterUsageOutgoingMessagePayload


class Changes(Schema):
    model_config = ConfigDict(use_attribute_docstrings=True)

    changes: list[MeterUsageOutgoingMessagePayload]
    """A snapshot of each customer and reducer that changed since the cursor."""
    cursor: str
    """Pull the next changes after this one."""
    has_more: bool
    """The page is full: pull again from the cursor right away."""
    reset: bool
    """Changes were missed: every snapshot the client holds may be stale. The client
    drops them, and fetches each customer again at its next read."""
    configuration_changed: bool
    """The organization's reducers changed: fetch the configuration again."""
    next_poll_in: int
    """Seconds until the next pull."""
