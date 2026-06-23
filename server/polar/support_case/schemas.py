from typing import Annotated, Self

from fastapi import Path
from pydantic import UUID4, Field, model_validator

from polar.exceptions import ResourceNotFound
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.support_case import (
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseType,
)

SupportCaseID = Annotated[UUID4, Path(description="The support case ID.")]
SupportCaseAttachmentID = Annotated[UUID4, Path(description="The attachment ID.")]

SupportCaseNotFound = {
    "description": "Support case not found.",
    "model": ResourceNotFound.schema(),
}


class SupportCaseMessage(IDSchema, TimestampedSchema):
    type: SupportCaseMessageType
    author_kind: SupportCaseMessageAuthorKind
    body: str | None


class SupportCase(IDSchema, TimestampedSchema):
    type: SupportCaseType


class SupportCaseAttachmentFile(Schema):
    name: str
    mime_type: str
    size: int


class SupportCaseAttachment(IDSchema, TimestampedSchema):
    # Null only for non-conversational (case-level) attachments; user uploads
    # always carry a message, so today this is always set.
    message_id: UUID4 | None
    file: SupportCaseAttachmentFile


class SupportCaseThread(Schema):
    case: SupportCase
    messages: list[SupportCaseMessage]
    attachments: list[SupportCaseAttachment]
    is_open: bool


class SupportCaseMessageCreate(Schema):
    """A reply: free text, attachments (already uploaded files), or both."""

    body: str | None = Field(default=None, min_length=1, max_length=5000)
    file_ids: list[UUID4] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _require_content(self) -> Self:
        if not self.body and not self.file_ids:
            raise ValueError("A reply needs a body, an attachment, or both.")
        return self


class HumanReviewRequest(Schema):
    reason: str = Field(min_length=50, max_length=5000)
