import typing
from datetime import datetime
from enum import StrEnum

from pydantic import UUID4, BaseModel, ConfigDict, Discriminator, TypeAdapter

from polar.meter.aggregation import Aggregation
from polar.meter.filter import Filter


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
    reducer_bucket = "reducer_bucket"
    reducer_seal = "reducer_seal"


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


class CustomerMeterOutgoingMessagePayload(MessageBase):
    customer_id: UUID4
    external_customer_id: str | None
    meter_id: UUID4
    consumed_units: float
    credited_units: int
    balance: float


class CustomerMeterOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.customer_meter]
    payload: CustomerMeterOutgoingMessagePayload


class ReducerBucketInterval(MessageBase):
    bucket_start: datetime
    bucket_end: datetime
    sealed: bool
    count: int
    sum: float
    min: float | None
    max: float | None


class ReducerBucketOutgoingMessagePayload(MessageBase):
    reducer_id: UUID4
    customer_id: UUID4 | None
    external_customer_id: str | None
    bucket_start: datetime
    intervals: list[ReducerBucketInterval]


class ReducerBucketOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.reducer_bucket]
    payload: ReducerBucketOutgoingMessagePayload


class ReducerSealOutgoingMessagePayload(MessageBase):
    reducer_id: UUID4
    customer_id: UUID4 | None
    external_customer_id: str | None
    sealed_until: datetime


class ReducerSealOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.reducer_seal]
    payload: ReducerSealOutgoingMessagePayload


type OutgoingMessage = typing.Annotated[
    ConfigurationOutgoingMessage
    | CustomerMeterOutgoingMessage
    | ReducerBucketOutgoingMessage
    | ReducerSealOutgoingMessage,
    Discriminator("type"),
]

OutgoingMessageAdapter: TypeAdapter[OutgoingMessage] = TypeAdapter(OutgoingMessage)
