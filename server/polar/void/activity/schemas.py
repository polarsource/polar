from datetime import datetime

from pydantic import Field

from polar.kit.schemas import Schema
from polar.void.entitlement.schemas import SLUG_PATTERN

from .taxonomy import DEFAULT_GROUP_BY


class DeployActivity(Schema):
    slug: str = Field(min_length=1, pattern=SLUG_PATTERN)
    event: str = Field(min_length=1, max_length=255)
    group_by: str = Field(default=DEFAULT_GROUP_BY, min_length=1, max_length=128)


class ActivityShare(Schema):
    slug: str
    cost: float
    share: float
    spans: int
    waste_cost: float


class ActivityTotals(Schema):
    cost: float
    labeled_cost: float
    unlabeled_cost: float
    pending_cost: float


class ActivityWindow(Schema):
    start: datetime | None = None
    end: datetime | None = None


class ActivityReport(Schema):
    window: ActivityWindow
    totals: ActivityTotals
    by_activity: list[ActivityShare]


class ActivitySpan(Schema):
    span_key: str
    activity: str
    activity_confidence: float | None
    waste: float | None
    cost: float | None
    input_tokens: int
    output_tokens: int
    event_count: int
    event_name: str
    external_identity_id: str | None
    first_event_at: datetime
    last_event_at: datetime
    classified_at: datetime | None
    event_ids: list[str] = Field(default_factory=list)
