from datetime import date
from uuid import UUID

from polar.kit.schemas import Schema


class TrackPageView(Schema):
    location_href: str
    article_id: UUID | None = None
    referrer: str | None = None


class TrackPageViewResponse(Schema):
    ok: bool


class TrafficStatisticsPeriod(Schema):
    start_date: date
    end_date: date
    views: int
    article_id: UUID | None = None
    # cumulative: int


class TrafficStatistics(Schema):
    periods: list[TrafficStatisticsPeriod]
