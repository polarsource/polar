import typing
from datetime import datetime
from enum import StrEnum

from pydantic import (
    UUID4,
    BaseModel,
    ConfigDict,
    Discriminator,
    PlainSerializer,
    TypeAdapter,
)

from polar.meter.aggregation import Aggregation
from polar.meter.filter import Filter


def to_epoch_microseconds(value: datetime) -> int:
    # round absorbs the float error of timestamp()
    return round(value.timestamp() * 1_000_000)


# Microseconds since the Unix epoch, so clients compare integers.
type EpochMicroseconds = typing.Annotated[
    datetime, PlainSerializer(to_epoch_microseconds, return_type=int)
]


class MessageBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class IncomingMessageType(StrEnum):
    configuration = "configuration"
    meter_usage = "meter_usage"


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


type IncomingMessage = typing.Annotated[
    ConfigurationIncomingMessage | MeterUsageIncomingMessage, Discriminator("type")
]

IncomingMessageAdapter: TypeAdapter[IncomingMessage] = TypeAdapter(IncomingMessage)


# ---


class OutgoingMessageType(StrEnum):
    connection = "connection"
    configuration = "configuration"
    meter_usage = "meter_usage"


class OutgoingMessageBase(MessageBase):
    type: OutgoingMessageType


class ConnectionOutgoingMessagePayload(MessageBase):
    id: UUID4


class ConnectionOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.connection]
    payload: ConnectionOutgoingMessagePayload


class ConfigurationReducer(MessageBase):
    id: UUID4
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


type OutgoingMessage = typing.Annotated[
    ConnectionOutgoingMessage
    | ConfigurationOutgoingMessage
    | MeterUsageOutgoingMessage,
    Discriminator("type"),
]

OutgoingMessageAdapter: TypeAdapter[OutgoingMessage] = TypeAdapter(OutgoingMessage)
