from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema
from polar.void.entitlement.schemas import SLUG_PATTERN

from .taxonomy import DEFAULT_GROUP_BY, TAXONOMY


class ActivityCreate(Schema):
    version_id: str = Field(pattern=r"^[0-9a-f]{64}$")
    slug: str = Field(min_length=1, pattern=SLUG_PATTERN)
    event_name: str = Field(min_length=1, max_length=255)
    group_by: str = Field(default=DEFAULT_GROUP_BY, min_length=1, max_length=128)
    run_by: str | None = Field(default=None, min_length=1, max_length=128)
    taxonomy: str = Field(default=TAXONOMY, min_length=1, max_length=64)


class DeployActivity(Schema):
    slug: str = Field(min_length=1, pattern=SLUG_PATTERN)
    event: str = Field(min_length=1, max_length=255)
    group_by: str = Field(default=DEFAULT_GROUP_BY, min_length=1, max_length=128)
    run_by: str | None = Field(default=None, min_length=1, max_length=128)
    taxonomy: str = Field(default=TAXONOMY, min_length=1, max_length=64)


class ActivityDefinition(Schema):
    id: UUID
    slug: str
    version_id: str
    event_name: str
    group_by: str
    run_by: str | None
    taxonomy: str
    created_at: datetime


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


class ActivityRun(Schema):
    run_key: str
    cost: float
    by_activity: list[ActivityShare]
    spans: int


class ActivityReport(Schema):
    taxonomy: str
    window: ActivityWindow
    totals: ActivityTotals
    by_activity: list[ActivityShare]
    runs: list[ActivityRun]


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
    run_key: str | None
    first_event_at: datetime
    last_event_at: datetime
    classified_at: datetime | None
    event_ids: list[str] = Field(default_factory=list)


ActivityGroup = Literal["run", "span"]
