from typing import Annotated, Literal

from pydantic import UUID4, Discriminator, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema

from .assistant.blocks import AssistantBlock


class AssistantTextPart(Schema):
    kind: Literal["text"] = "text"
    text: str


class AssistantBlockPart(Schema):
    kind: Literal["block"] = "block"
    block: AssistantBlock


AssistantPart = Annotated[AssistantTextPart | AssistantBlockPart, Discriminator("kind")]


class CompassThreadSchema(IDSchema, TimestampedSchema):
    organization_id: UUID4
    title: str


class CompassThreadMessageSchema(IDSchema, TimestampedSchema):
    prompt: str
    parts: list[AssistantPart]


class CompassThreadWithMessages(CompassThreadSchema):
    messages: list[CompassThreadMessageSchema] = Field(
        description="Most recent turns, oldest first."
    )
    has_more: bool = Field(
        description="Whether older turns exist beyond the ones returned."
    )


class CompassThreadUpdate(Schema):
    title: str = Field(min_length=1, max_length=200)
