import typing
from enum import StrEnum

from pydantic import UUID4, BaseModel, ConfigDict, Discriminator, TypeAdapter

from polar.meter.aggregation import Aggregation
from polar.meter.filter import Filter


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
    configuration = "configuration"
    meter_usage = "meter_usage"


class OutgoingMessageBase(MessageBase):
    type: OutgoingMessageType


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
    customer_id: UUID4 | None
    external_customer_id: str | None
    count: int
    sum: float
    min: float | None
    max: float | None
    # Temporary: credits come from customer meters until credits are reducers.
    credited_units: int


class MeterUsageOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.meter_usage]
    payload: MeterUsageOutgoingMessagePayload


type OutgoingMessage = typing.Annotated[
    ConfigurationOutgoingMessage | MeterUsageOutgoingMessage,
    Discriminator("type"),
]

OutgoingMessageAdapter: TypeAdapter[OutgoingMessage] = TypeAdapter(OutgoingMessage)
