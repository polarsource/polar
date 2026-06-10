from pydantic import Field

from polar.exceptions import ResourceNotFound
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.models.support_case import (
    SupportCaseMessageAuthorKind,
    SupportCaseMessageType,
    SupportCaseType,
)

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


class SupportCaseThread(Schema):
    case: SupportCase
    messages: list[SupportCaseMessage]
    is_open: bool


class SupportCaseMessageCreate(Schema):
    body: str = Field(min_length=1, max_length=5000)


class HumanReviewRequest(Schema):
    reason: str = Field(min_length=50, max_length=5000)
