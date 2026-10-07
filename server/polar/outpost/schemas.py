import typing
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Discriminator, TypeAdapter

from polar.meter.schemas import Meter


class MessageBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class IncomingMessageType(StrEnum):
    configuration = "configuration"


class IncomingMessageBase(MessageBase):
    type: IncomingMessageType


class ConfigurationIncomingMessage(IncomingMessageBase):
    type: typing.Literal[IncomingMessageType.configuration]


type IncomingMessage = typing.Annotated[
    ConfigurationIncomingMessage, Discriminator("type")
]

IncomingMessageAdapter: TypeAdapter[IncomingMessage] = TypeAdapter(IncomingMessage)

# ---


class OutgoingMessageType(StrEnum):
    configuration = "configuration"


class OutgoingMessageBase(MessageBase):
    type: OutgoingMessageType


class ConfigurationOutgoingMessagePayload(BaseModel):
    meters: list[Meter]


class ConfigurationOutgoingMessage(OutgoingMessageBase):
    type: typing.Literal[OutgoingMessageType.configuration]
    payload: ConfigurationOutgoingMessagePayload


type OutgoingMessage = typing.Annotated[
    ConfigurationOutgoingMessage, Discriminator("type")
]

OutgoingMessageAdapter: TypeAdapter[OutgoingMessage] = TypeAdapter(OutgoingMessage)
