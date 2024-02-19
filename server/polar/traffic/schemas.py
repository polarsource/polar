from datetime import date
from uuid import UUID

from polar.kit.schemas import Schema


class TrackPageView(Schema):
    article_id: UUID | None = None
    referrer: str | None = None


class TrackPageViewResponse(Schema):
    ok: bool


class TrafficStatisticsPeriod(Schema):
    start_date: date
    end_date: date
    views: int
    cumulative: int


class TrafficStatistics(Schema):
    periods: list[TrafficStatisticsPeriod]
