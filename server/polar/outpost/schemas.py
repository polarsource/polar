import typing
from datetime import UTC, datetime
from enum import StrEnum

from pydantic import (
    UUID4,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Discriminator,
    Field,
    PlainSerializer,
    TypeAdapter,
)

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

# Pending ids per confirmation request: the client splits a bigger bucket.
CONFIRM_MAX_IDS = 1000


class MessageBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class IncomingMessageType(StrEnum):
    configuration = "configuration"
    meter_usage = "meter_usage"
    confirm = "confirm"


class IncomingMessageBase(MessageBase):
    type: IncomingMessageType


class ConfigurationIncomingMessage(IncomingMessageBase):
    type: typing.Literal[IncomingMessageType.configuration]


class MeterUsageIncomingMessagePayloadBase(MessageBase):
    meter_id: UUID4


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


class MeterUsageIncomingMessage(IncomingMessageBase):
    type: typing.Literal[IncomingMessageType.meter_usage]
    payload: MeterUsageIncomingMessagePayload


class ConfirmIncomingMessagePayloadBase(MessageBase):
    reducer_id: UUID4
    # The meter whose snapshot the answer carries, read with the ids.
    meter_id: UUID4
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


class ConfirmIncomingMessage(IncomingMessageBase):
    type: typing.Literal[IncomingMessageType.confirm]
    payload: ConfirmIncomingMessagePayload


type IncomingMessage = typing.Annotated[
    ConfigurationIncomingMessage | MeterUsageIncomingMessage | ConfirmIncomingMessage,
    Discriminator("type"),
]

IncomingMessageAdapter: TypeAdapter[IncomingMessage] = TypeAdapter(IncomingMessage)


# ---


class OutgoingMessageType(StrEnum):
    connection = "connection"
    configuration = "configuration"
    meter_usage = "meter_usage"
    confirmed = "confirmed"


class OutgoingMessageBase(MessageBase):
    type: OutgoingMessageType


class ConnectionOutgoingMessagePayload(MessageBase):
    id: UUID4


class ConnectionOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.connection]
    payload: ConnectionOutgoingMessagePayload


class ConfigurationReducer(MessageBase):
    id: UUID4
    kind: ReducerKind
    filter: Filter
    aggregation: Aggregation
    meter_ids: list[UUID4]


class ConfigurationOutgoingMessagePayload(MessageBase):
    reducers: list[ConfigurationReducer]


class ConfigurationOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.configuration]
    payload: ConfigurationOutgoingMessagePayload


class MeterUsageOutgoingMessagePayload(MessageBase):
    meter_id: UUID4
    # The bucket identity as events carry it: a customer can have several.
    customer_id: UUID4 | None
    external_customer_id: str | None
    customer_exists: bool
    # Database time of the read: keep the payload with the highest version.
    version: EpochMicroseconds
    # Temporary: the customer's credits, the same for each of its identities,
    # until credits are reducers.
    credited_units: int
    # Usage before this is Polar's; Outpost counts its own from there on.
    cold_until: EpochMicroseconds
    count: int
    sum: float
    min: float | None
    max: float | None


class MeterUsageOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.meter_usage]
    payload: MeterUsageOutgoingMessagePayload


class ConfirmedOutgoingMessagePayload(MessageBase):
    reducer_id: UUID4
    customer_id: UUID4 | None
    external_customer_id: str | None
    bucket_start: EpochMicroseconds
    # The requested ids the snapshot counts; the rest stay pending.
    ids: list[str]
    # Read in the same transaction as the ids, so the two agree.
    snapshot: MeterUsageOutgoingMessagePayload


class ConfirmedOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.confirmed]
    payload: ConfirmedOutgoingMessagePayload


type OutgoingMessage = typing.Annotated[
    ConnectionOutgoingMessage
    | ConfigurationOutgoingMessage
    | MeterUsageOutgoingMessage
    | ConfirmedOutgoingMessage,
    Discriminator("type"),
]

OutgoingMessageAdapter: TypeAdapter[OutgoingMessage] = TypeAdapter(OutgoingMessage)
