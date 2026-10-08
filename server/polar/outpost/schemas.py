import typing
from enum import StrEnum

from pydantic import UUID4, BaseModel, ConfigDict, Discriminator, TypeAdapter

from polar.meter.aggregation import Aggregation
from polar.meter.filter import Filter
from polar.meter.schemas import Meter


class MessageBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class IncomingMessageType(StrEnum):
    configuration = "configuration"
    customer_meter = "customer_meter"


class IncomingMessageBase(MessageBase):
    type: IncomingMessageType


class ConfigurationIncomingMessage(IncomingMessageBase):
    type: typing.Literal[IncomingMessageType.configuration]


class CustomerMeterIncomingMessagePayloadBase(MessageBase):
    meter_id: UUID4


class CustomerMeterIncomingMessageCustomerPayload(
    CustomerMeterIncomingMessagePayloadBase
):
    customer_id: UUID4


class CustomerMeterIncomingMessageExternalCustomerPayload(
    CustomerMeterIncomingMessagePayloadBase
):
    external_customer_id: str


type CustomerMeterIncomingMessagePayload = (
    CustomerMeterIncomingMessageCustomerPayload
    | CustomerMeterIncomingMessageExternalCustomerPayload
)


class CustomerMeterIncomingMessage(IncomingMessageBase):
    type: typing.Literal[IncomingMessageType.customer_meter]
    payload: CustomerMeterIncomingMessagePayload


type IncomingMessage = typing.Annotated[
    ConfigurationIncomingMessage | CustomerMeterIncomingMessage, Discriminator("type")
]

IncomingMessageAdapter: TypeAdapter[IncomingMessage] = TypeAdapter(IncomingMessage)


# ---


class OutgoingMessageType(StrEnum):
    configuration = "configuration"
    customer_meter = "customer_meter"


class OutgoingMessageBase(MessageBase):
    type: OutgoingMessageType


class ConfigurationReducer(MessageBase):
    id: UUID4
    filter: Filter
    aggregation: Aggregation
    meter_ids: list[UUID4]


class ConfigurationOutgoingMessagePayload(MessageBase):
    meters: list[Meter]
    reducers: list[ConfigurationReducer]


class ConfigurationOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.configuration]
    payload: ConfigurationOutgoingMessagePayload


class CustomerMeterOutgoingMessagePayload(MessageBase):
    customer_id: UUID4
    external_customer_id: str | None
    meter_id: UUID4
    consumed_units: float
    credited_units: int
    balance: float
    last_balance_event_ingest_sequence: int | None


class CustomerMeterOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.customer_meter]
    payload: CustomerMeterOutgoingMessagePayload


type OutgoingMessage = typing.Annotated[
    ConfigurationOutgoingMessage | CustomerMeterOutgoingMessage, Discriminator("type")
]

OutgoingMessageAdapter: TypeAdapter[OutgoingMessage] = TypeAdapter(OutgoingMessage)
