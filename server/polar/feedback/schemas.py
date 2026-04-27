from typing import Any
from uuid import UUID

from pydantic import UUID4, Field

from polar.kit.schemas import Schema, TimestampedSchema
from polar.models.feedback import FeedbackStatus, FeedbackType


class FeedbackCreate(Schema):
    type: FeedbackType
    message: str = Field(min_length=10, max_length=5000)
    organization_id: UUID
    client_context: dict[str, Any] = Field(default_factory=dict)


class Feedback(TimestampedSchema):
    id: UUID4
    type: FeedbackType
    status: FeedbackStatus
    message: str
    client_context: dict[str, Any]
    user_id: UUID4
    organization_id: UUID4
