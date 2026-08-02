from typing import Annotated, Literal

from pydantic import UUID4, Discriminator, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema

from .blocks import AssistantBlock


class AssistantChatRequest(Schema):
    """One turn of the Compass assistant conversation."""

    organization_id: UUID4 = Field(
        description="Organization the conversation is about. Must be accessible "
        "to the caller; tools are always scoped to it."
    )
    prompt: str = Field(min_length=1, max_length=4000)
    thread_id: UUID4 | None = Field(
        default=None,
        description=(
            "Thread to continue, from a previous turn's `done` event or the "
            "thread list. Omit to start a new thread."
        ),
    )


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
    messages: list[CompassThreadMessageSchema]


class CompassThreadUpdate(Schema):
    title: str = Field(min_length=1, max_length=200)
