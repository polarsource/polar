import uuid
from collections.abc import Sequence
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import structlog

from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.authz.types import AccessibleOrganizationID
from polar.kit.time_queries import TimeInterval
from polar.logging import Logger
from polar.metrics.service import metrics as metrics_service
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession
from polar.redis import Redis

from .detectors import DETECTORS, Detector, DetectorContext
from .schemas import (
    ConfidenceLevel,
    Insight,
    InsightCategory,
    InsightSeverity,
)

log: Logger = structlog.get_logger()

# Extra days beyond the longest detector lookback so a `value_n_periods_ago`
# baseline is always present in the fetched series.
_LOOKBACK_HEADROOM_DAYS = 5

# What the merchant should care about most, first. Detector priority and
# confidence only break ties within a severity band.
_SEVERITY_RANK: dict[InsightSeverity, int] = {
    InsightSeverity.critical: 0,
    InsightSeverity.warning: 1,
    InsightSeverity.opportunity: 2,
    InsightSeverity.info: 3,
}

_CONFIDENCE_RANK: dict[ConfidenceLevel, int] = {
    ConfidenceLevel.high: 0,
    ConfidenceLevel.medium: 1,
    ConfidenceLevel.low: 2,
}


class CompassService:
    async def list_insights(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        timezone: ZoneInfo,
        organization_id: Sequence[uuid.UUID] | None = None,
        category: Sequence[InsightCategory] | None = None,
        now: datetime | None = None,
        redis: Redis | None = None,
    ) -> list[Insight]:
        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.analytics_read
        )
        if organization_id is not None:
            org_ids = {oid for oid in org_ids if oid in set(organization_id)}
        # Compass is gated per organization by the `compass_enabled` feature flag.
        org_ids = await self._compass_enabled_org_ids(session, org_ids)
        detectors = self._select_detectors(category)
        if not org_ids or not detectors:
            return []

        today = (now or datetime.now(tz=timezone)).astimezone(timezone).date()
        # One window serves every detector: the union of their slugs over the
        # longest lookback, fetched once per organization.
        slugs = sorted({slug for d in detectors for slug in d.metric_slugs})
        days = max(d.lookback_days for d in detectors) + _LOOKBACK_HEADROOM_DAYS

        # Organizations are processed serially on purpose: the session (and its
        # `SET LOCAL` connection state inside the metrics service) must not be
        # used concurrently.
        insights: list[Insight] = []
        for org_id in org_ids:
            try:
                response = await metrics_service.get_metrics(
                    session,
                    auth_subject,
                    start_date=today - timedelta(days=days),
                    end_date=today,
                    timezone=timezone,
                    interval=TimeInterval.day,
                    organization_id=[org_id],
                    metrics=slugs,
                    redis=redis,
                )
            except Exception:
                # One organization's metrics failing shouldn't blank the feed.
                log.exception("compass.metrics_error", organization_id=str(org_id))
                continue

            ctx = DetectorContext(
                organization_id=org_id,
                timezone=timezone,
                today=today,
                metrics=response,
            )
            for detector in detectors:
                try:
                    insight = detector.evaluate(ctx)
                except Exception:
                    # A broken detector drops its own card, not the feed.
                    log.exception(
                        "compass.detector_error",
                        detector_id=detector.id,
                        organization_id=str(org_id),
                    )
                    continue
                if insight is not None:
                    insights.append(insight)

        if not insights:
            return []

        priority: dict[str, int] = {d.id: d.priority for d in detectors}
        insights.sort(
            key=lambda i: (
                _SEVERITY_RANK[i.severity],
                priority[i.detector_id],
                _CONFIDENCE_RANK[i.confidence],
            )
        )
        return insights

    async def _compass_enabled_org_ids(
        self,
        session: AsyncReadSession,
        org_ids: set[AccessibleOrganizationID],
    ) -> set[AccessibleOrganizationID]:
        if not org_ids:
            return org_ids
        repository = OrganizationRepository.from_session(session)
        organizations = await repository.get_all(
            repository.get_statement_by_org_ids(org_ids)
        )
        return {
            AccessibleOrganizationID(org.id)
            for org in organizations
            if org.is_compass_enabled
        }

    def _select_detectors(
        self, category: Sequence[InsightCategory] | None
    ) -> list[Detector]:
        if category is None:
            return DETECTORS
        wanted = set(category)
        return [d for d in DETECTORS if d.category in wanted]


compass = CompassService()


__all__ = ["CompassService", "compass"]
