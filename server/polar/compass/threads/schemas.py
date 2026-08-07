from typing import Annotated, Literal

from pydantic import UUID4, Discriminator, StringConstraints

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema

from ..assistant.blocks import AssistantBlock

TITLE_MAX_LENGTH = 80
"""Cap for both generated and user-supplied thread titles."""

ThreadTitle = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=TITLE_MAX_LENGTH),
]
"""Stripped before the length check, so a whitespace-only title is rejected
rather than stored as a blank row in the history menu."""


class AssistantTextPart(Schema):
    """A run of assistant prose, as it was streamed."""

    kind: Literal["text"] = "text"
    text: str


class AssistantBlockPart(Schema):
    """A renderable block, at the position the model placed it."""

    kind: Literal["block"] = "block"
    block: AssistantBlock


AssistantPart = Annotated[AssistantTextPart | AssistantBlockPart, Discriminator("kind")]


class CompassThreadSchema(IDSchema, TimestampedSchema):
    """An assistant conversation thread."""

    organization_id: UUID4
    title: str


class CompassThreadMessageSchema(IDSchema, TimestampedSchema):
    """One completed turn: the user's prompt and the rendered answer."""

    prompt: str
    parts: list[AssistantPart]


class CompassThreadUpdate(Schema):
    title: ThreadTitle | None = None
