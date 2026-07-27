from pydantic import UUID4, Field

from polar.kit.schemas import Schema


class AssistantChatRequest(Schema):
    """One turn of the Compass assistant conversation."""

    organization_id: UUID4 = Field(
        description="Organization the conversation is about. Must be accessible "
        "to the caller; tools are always scoped to it."
    )
    prompt: str = Field(min_length=1, max_length=4000)
    message_history: str | None = Field(
        default=None,
        description=(
            "Opaque conversation state from the previous turn's `done` event. "
            "Send it back verbatim to continue the conversation; omit to start "
            "a new one."
        ),
    )
