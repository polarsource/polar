from collections.abc import Sequence
from datetime import date
from uuid import UUID

from polar.kit.schemas import Schema


class TrackPageView(Schema):
    location_href: str
    article_id: UUID | None = None
    organization_id: UUID | None = None
    referrer: str | None = None


class TrackPageViewResponse(Schema):
    ok: bool


class TrafficStatisticsPeriod(Schema):
    start_date: date
    end_date: date
    views: int
    article_id: UUID | None = None


class TrafficStatistics(Schema):
    periods: Sequence[TrafficStatisticsPeriod]


class TrafficReferrer(Schema):
    referrer: str
    views: int


class TrafficReferrers(Schema):
    referrers: Sequence[TrafficReferrer]
