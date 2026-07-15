from typing import Annotated, Literal, Self

from fastapi import Path
from pydantic import UUID4, Discriminator, Field, TypeAdapter, model_validator

from polar.dispute.schemas import Dispute
from polar.exceptions import ResourceNotFound
from polar.kit.schemas import (
    ClassName,
    IDSchema,
    Schema,
    SetSchemaReference,
    TimestampedSchema,
)
from polar.models.support_case import (
    DisputeWinReason,
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


class SupportCaseListItemBase(IDSchema, TimestampedSchema): ...


class DisputeSupportCaseListItem(SupportCaseListItemBase):
    type: Literal[SupportCaseType.dispute]
    dispute: Dispute = Field(description="The dispute this case handles.")


class ReviewAppealSupportCaseListItem(SupportCaseListItemBase):
    type: Literal[SupportCaseType.review_appeal]


SupportCaseListItem = Annotated[
    DisputeSupportCaseListItem | ReviewAppealSupportCaseListItem,
    Discriminator("type"),
    SetSchemaReference("SupportCaseListItem"),
    ClassName("SupportCaseListItem"),
]

SupportCaseListItemAdapter: TypeAdapter[SupportCaseListItem] = TypeAdapter[
    SupportCaseListItem
](SupportCaseListItem)


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


class SupportCaseMessageCreateBase(Schema):
    """A reply: free text, attachments (already uploaded files), or both."""

    body: str | None = Field(default=None, min_length=1, max_length=5000)
    file_ids: list[UUID4] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def _require_content(self) -> Self:
        if not self.body and not self.file_ids:
            raise ValueError("A reply needs a body, an attachment, or both.")
        return self


class ReviewAppealSupportCaseMessageCreate(SupportCaseMessageCreateBase):
    """A reply on a review-appeal case."""

    type: Literal[SupportCaseType.review_appeal]


class DisputeSupportCaseMessageCreate(SupportCaseMessageCreateBase):
    """A reply on a dispute case."""

    type: Literal[SupportCaseType.dispute]
    win_reason: DisputeWinReason | None = Field(
        default=None,
        description=(
            "The merchant's stated grounds for contesting, "
            "set on the counter submission."
        ),
    )
    win_reason_other: str | None = Field(
        default=None,
        min_length=1,
        max_length=500,
        description="Free-text detail when `win_reason` is `other`.",
    )

    @model_validator(mode="after")
    def _validate_win_reason(self) -> Self:
        if (
            self.win_reason_other is not None
            and self.win_reason != DisputeWinReason.other
        ):
            raise ValueError(
                "win_reason_other is only allowed when win_reason is `other`."
            )
        if self.win_reason == DisputeWinReason.other and not self.win_reason_other:
            raise ValueError("win_reason `other` requires win_reason_other.")
        return self


SupportCaseMessageCreate = Annotated[
    ReviewAppealSupportCaseMessageCreate | DisputeSupportCaseMessageCreate,
    Discriminator("type"),
    SetSchemaReference("SupportCaseMessageCreate"),
]


class HumanReviewRequest(Schema):
    reason: str = Field(min_length=50, max_length=5000)
