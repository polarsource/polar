import asyncio
import uuid
from collections.abc import Sequence
from datetime import datetime
from zoneinfo import ZoneInfo

from polar.auth.models import AuthSubject, Organization, User, is_user
from polar.auth.permission import OrganizationPermission
from polar.authz.service import get_accessible_org_ids
from polar.exceptions import NotPermitted, PolarRequestValidationError
from polar.metrics.service import metrics as metrics_service
from polar.models import InsightFeedback
from polar.postgres import AsyncReadSession, AsyncSession
from polar.redis import Redis

from .detectors import DETECTORS, Detector, DetectorContext
from .repository import InsightFeedbackRepository
from .schemas import Insight, InsightCategory, InsightFeedbackCreate


class InsightsService:
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
        if not org_ids:
            return []

        today = (now or datetime.now(tz=timezone)).astimezone(timezone).date()
        detectors = self._select_detectors(category)

        # One context per org; run every detector for every org concurrently.
        tasks = [
            self._evaluate(
                detector,
                DetectorContext(
                    session=session,
                    auth_subject=auth_subject,
                    organization_id=org_id,
                    timezone=timezone,
                    today=today,
                    redis=redis,
                    metrics_service=metrics_service,
                ),
            )
            for org_id in org_ids
            for detector in detectors
        ]
        results = await asyncio.gather(*tasks)
        insights = [insight for insight in results if insight is not None]

        # Hide anything the merchant has already dismissed or flagged.
        repository = InsightFeedbackRepository.from_session(session)
        suppressed = await repository.get_keys_with_feedback(list(org_ids))
        return [insight for insight in insights if insight.id not in suppressed]

    def _select_detectors(
        self, category: Sequence[InsightCategory] | None
    ) -> list[Detector]:
        if category is None:
            return DETECTORS
        wanted = set(category)
        return [d for d in DETECTORS if d.category in wanted]

    async def _evaluate(
        self, detector: Detector, ctx: DetectorContext
    ) -> Insight | None:
        return await detector.evaluate(ctx)

    async def record_feedback(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        insight_key: str,
        create: InsightFeedbackCreate,
    ) -> InsightFeedback:
        detector_id, organization_id = self._parse_key(insight_key)

        org_ids = await get_accessible_org_ids(
            session, auth_subject, permission=OrganizationPermission.analytics_read
        )
        if organization_id not in org_ids:
            raise NotPermitted()

        repository = InsightFeedbackRepository.from_session(session)
        feedback = InsightFeedback(
            insight_key=insight_key,
            detector_id=detector_id,
            action=create.action,
            organization_id=organization_id,
            user_id=auth_subject.subject.id if is_user(auth_subject) else None,
        )
        return await repository.create(feedback, flush=True)

    def _parse_key(self, insight_key: str) -> tuple[str, uuid.UUID]:
        parts = insight_key.split(":")
        if len(parts) < 3:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("path", "insight_key"),
                        "msg": "Malformed insight key.",
                        "type": "value_error",
                        "input": insight_key,
                    }
                ]
            )
        try:
            organization_id = uuid.UUID(parts[1])
        except ValueError as e:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("path", "insight_key"),
                        "msg": "Malformed insight key.",
                        "type": "value_error",
                        "input": insight_key,
                    }
                ]
            ) from e
        return parts[0], organization_id


insights = InsightsService()


__all__ = ["InsightsService", "insights"]
