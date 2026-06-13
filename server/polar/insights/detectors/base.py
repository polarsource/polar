import abc
import uuid
from dataclasses import dataclass
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from polar.auth.models import AuthSubject, Organization, User
from polar.kit.time_queries import TimeInterval
from polar.metrics.schemas import MetricsResponse
from polar.metrics.service import MetricsService
from polar.postgres import AsyncReadSession
from polar.redis import Redis

from ..schemas import (
    ConfidenceLevel,
    Insight,
    InsightAction,
    InsightCategory,
    InsightDriver,
)

# Minimum population before an insight is trustworthy enough to surface at all.
_MIN_SAMPLE = 5
_MEDIUM_SAMPLE = 20
_HIGH_SAMPLE = 100


def confidence_for_sample(sample_n: int) -> ConfidenceLevel | None:
    """Map a sample size to a confidence level, or None to suppress entirely."""
    if sample_n < _MIN_SAMPLE:
        return None
    if sample_n < _MEDIUM_SAMPLE:
        return ConfidenceLevel.low
    if sample_n < _HIGH_SAMPLE:
        return ConfidenceLevel.medium
    return ConfidenceLevel.high


@dataclass
class DetectorContext:
    """Everything a detector needs to read the business for one organization."""

    session: AsyncReadSession
    auth_subject: AuthSubject[User | Organization]
    organization_id: uuid.UUID
    timezone: ZoneInfo
    today: date
    redis: Redis | None
    metrics_service: MetricsService

    async def metrics(
        self,
        slugs: list[str],
        *,
        days: int,
        interval: TimeInterval = TimeInterval.day,
    ) -> MetricsResponse:
        """Fetch a metric series for this org spanning the last `days` days."""
        return await self.metrics_service.get_metrics(
            self.session,
            self.auth_subject,
            start_date=self.today - timedelta(days=days),
            end_date=self.today,
            timezone=self.timezone,
            interval=interval,
            organization_id=[self.organization_id],
            metrics=slugs,
            redis=self.redis,
        )


class Detector(abc.ABC):
    """
    A single rule that reads metric signals and may emit one insight.

    Detectors are deterministic and pure given their signals, which keeps them
    trivially unit-testable: feed a `MetricsResponse`, assert the `Insight`.
    """

    id: str
    category: InsightCategory
    category_label: str

    @abc.abstractmethod
    async def evaluate(self, ctx: DetectorContext) -> Insight | None:
        """Return an insight if this detector fires for the org, else None."""
        ...

    def build_insight(
        self,
        ctx: DetectorContext,
        *,
        period_bucket: str,
        title: str,
        body: str,
        confidence: ConfidenceLevel,
        why: str | None = None,
        primary_action: InsightAction | None = None,
        drivers: list[InsightDriver] | None = None,
    ) -> Insight:
        return Insight(
            id=f"{self.id}:{ctx.organization_id}:{period_bucket}",
            detector_id=self.id,
            category=self.category,
            category_label=self.category_label,
            title=title,
            body=body,
            why=why,
            confidence=confidence,
            primary_action=primary_action,
            drivers=drivers or [],
        )
