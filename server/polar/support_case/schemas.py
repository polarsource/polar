from pydantic import UUID4, Field

from polar.exceptions import ResourceNotFound
from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.support_case import SupportCaseMessageAuthorKind, SupportCaseType

SupportCaseNotFound = {
    "description": "Support case not found.",
    "model": ResourceNotFound.schema(),
}


class SupportCaseMessage(TimestampedSchema):
    id: UUID4
    type: str
    author_kind: SupportCaseMessageAuthorKind
    body: str | None


class SupportCase(TimestampedSchema):
    id: UUID4
    type: SupportCaseType
    is_open: bool


class SupportCaseThread(Schema):
    case: SupportCase
    messages: list[SupportCaseMessage]


class SupportCaseMessageCreate(Schema):
    body: str = Field(min_length=1, max_length=5000)


class HumanReviewRequest(Schema):
    reason: str = Field(min_length=50, max_length=5000)
