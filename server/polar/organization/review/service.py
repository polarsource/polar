from datetime import datetime, timedelta
from uuid import UUID

from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.utils import utc_now
from polar.models import Organization, OrganizationReviewEvent
from polar.models.organization import OrganizationStatus
from polar.models.organization_review_event import (
    OrganizationReviewDetails,
    OrganizationReviewReason,
    OrganizationReviewType,
    OrganizationReviewVerdict,
)
from polar.worker import enqueue_job

from .repository import OrganizationReviewEventRepository, RiskMetricsRepository
from .schemas import RiskStats, ThresholdOverride, TimeframeMetrics


class OrganizationReviewService:
    """Service for managing organization risk monitoring and review triggers."""

    def _enqueue(self, organization: Organization, *, task: str, metric: str) -> None:
        # TODO: Add logging for both?
        if not self._should_skip_check(organization, metric):
            enqueue_job(task, organization_id=organization.id)


    def enqueue_review_payments(self, organization: Organization) -> None:
        if not self._should_skip_check(organization, "payment_metrics"):
            return

        enqueue_job(
            "organization.review.check_payments",
            organization_id=organization.id
        )

    async def check_payments(
        self, session: AsyncSession, organization_id: UUID
    ) -> None:
        """
        Check payment-related metrics (auth rate and P90 risk score) for an organization.
        Triggered by payment_intent.succeeded or payment_intent.payment_failed webhooks.
        """
        org = await self._get_active_organization(session, organization_id)
        if org is None:
            return

        if self._should_skip_check(org, "payment_metrics"):
            return

        metrics_repo = RiskMetricsRepository(session)
        (
            attempts_30d,
            successes_30d,
            attempts_all_time,
            successes_all_time,
            p90_risk,
        ) = await metrics_repo.calculate_payment_metrics(organization_id)

        auth_rate_30d = successes_30d / attempts_30d if attempts_30d > 0 else None
        auth_rate_all_time = (
            successes_all_time / attempts_all_time if attempts_all_time > 0 else None
        )

        stats = RiskStats(
            last_30d=TimeframeMetrics(
                payment_attempt_count=attempts_30d,
                payment_count=successes_30d,
                auth_rate=auth_rate_30d,
                p90_risk_score=p90_risk,
            ),
            all_time=TimeframeMetrics(
                payment_attempt_count=attempts_all_time,
                payment_count=successes_all_time,
                auth_rate=auth_rate_all_time,
            ),
        )

        await metrics_repo.update_risk_metrics(
            organization_id, stats.to_30d_json(), stats.to_all_time_json()
        )

        # Check auth rate threshold
        auth_threshold = self._get_threshold(
            org, "auth_rate", settings.RISK_AUTH_RATE_THRESHOLD
        )
        if (
            attempts_30d >= settings.RISK_MIN_PAYMENTS_FOR_CHECK
            and auth_rate_30d is not None
            and auth_rate_30d < auth_threshold
        ):
            await self._create_review_event(
                session,
                org,
                OrganizationReviewReason.AUTH_RATE,
                {
                    "reason": "auth_rate",
                    "value": auth_rate_30d,
                    "threshold": auth_threshold,
                    "window": "30d",
                    "payment_attempt_count": attempts_30d,
                    "payment_count": successes_30d,
                },
            )
            return  # Don't double-trigger

        # Check P90 risk score threshold
        risk_threshold = self._get_threshold(
            org, "risk_score", settings.RISK_P90_SCORE_THRESHOLD
        )
        if (
            successes_30d >= settings.RISK_MIN_PAYMENTS_FOR_CHECK
            and p90_risk is not None
            and p90_risk > risk_threshold
        ):
            await self._create_review_event(
                session,
                org,
                OrganizationReviewReason.RISK_SCORE,
                {
                    "reason": "risk_score",
                    "value": p90_risk,
                    "threshold": risk_threshold,
                    "window": "30d",
                    "payment_count": successes_30d,
                },
            )

    async def check_refund_rate(
        self, session: AsyncSession, organization_id: UUID
    ) -> None:
        """
        Check refund rate for an organization.
        Triggered by refund creation.
        """
        org = await self._get_active_organization(session, organization_id)
        if org is None:
            return

        if self._should_skip_check(org, "refund_rate"):
            return

        metrics_repo = RiskMetricsRepository(session)
        (
            payments_30d,
            refunds_30d,
            payments_all_time,
            refunds_all_time,
        ) = await metrics_repo.calculate_refund_rate_stats(organization_id)

        stats = RiskStats(
            last_30d=TimeframeMetrics(
                payment_count=payments_30d,
                refund_count=refunds_30d,
                refund_rate=refunds_30d / payments_30d if payments_30d > 0 else None,
            ),
            all_time=TimeframeMetrics(
                payment_count=payments_all_time,
                refund_count=refunds_all_time,
                refund_rate=(
                    refunds_all_time / payments_all_time
                    if payments_all_time > 0
                    else None
                ),
            ),
        )

        await metrics_repo.update_risk_metrics(
            organization_id, stats.to_30d_json(), stats.to_all_time_json()
        )

        # Check threshold
        threshold = self._get_threshold(
            org, "refund_rate", settings.RISK_REFUND_RATE_THRESHOLD
        )
        if (
            stats.last_30d.refund_rate is not None
            and stats.last_30d.refund_rate > threshold
        ):
            await self._create_review_event(
                session,
                org,
                OrganizationReviewReason.REFUND_RATE,
                {
                    "reason": "refund_rate",
                    "value": stats.last_30d.refund_rate,
                    "threshold": threshold,
                    "window": "30d",
                    "payment_count": payments_30d,
                    "refund_count": refunds_30d,
                },
            )

    def enqueue_review_disputes(self, organization_id: UUID) -> None:
        enqueue_job(
            "organization.review.check_dispute_rate", organization_id=organization_id
        )

    async def check_dispute_rate(
        self, session: AsyncSession, organization_id: UUID
    ) -> None:
        """
        Check dispute and chargeback rates for an organization.
        Triggered by dispute webhook.
        """
        org = await self._get_active_organization(session, organization_id)
        if org is None:
            return

        if self._should_skip_check(org, "dispute_rate"):
            return

        metrics_repo = RiskMetricsRepository(session)
        (
            payments_30d,
            disputes_30d,
            chargebacks_30d,
            payments_all_time,
            disputes_all_time,
            chargebacks_all_time,
        ) = await metrics_repo.calculate_dispute_stats(org.id)

        dispute_rate_30d = disputes_30d / payments_30d if payments_30d > 0 else None
        chargeback_rate_30d = (
            chargebacks_30d / payments_30d if payments_30d > 0 else None
        )
        dispute_rate_all_time = (
            disputes_all_time / payments_all_time if payments_all_time > 0 else None
        )
        chargeback_rate_all_time = (
            chargebacks_all_time / payments_all_time if payments_all_time > 0 else None
        )

        stats = RiskStats(
            last_30d=TimeframeMetrics(
                payment_count=payments_30d,
                dispute_count=disputes_30d,
                dispute_rate=dispute_rate_30d,
                chargeback_count=chargebacks_30d,
                chargeback_rate=chargeback_rate_30d,
            ),
            all_time=TimeframeMetrics(
                payment_count=payments_all_time,
                dispute_count=disputes_all_time,
                dispute_rate=dispute_rate_all_time,
                chargeback_count=chargebacks_all_time,
                chargeback_rate=chargeback_rate_all_time,
            ),
        )

        await metrics_repo.update_risk_metrics(
            organization_id, stats.to_30d_json(), stats.to_all_time_json()
        )

        # Check dispute rate threshold
        dispute_threshold = self._get_threshold(
            org, "dispute_rate", settings.RISK_DISPUTE_RATE_THRESHOLD
        )
        if dispute_rate_30d is not None and dispute_rate_30d > dispute_threshold:
            await self._create_review_event(
                session,
                org,
                OrganizationReviewReason.DISPUTE_RATE,
                {
                    "reason": "dispute_rate",
                    "value": dispute_rate_30d,
                    "threshold": dispute_threshold,
                    "window": "30d",
                    "payment_count": payments_30d,
                    "dispute_count": disputes_30d,
                },
            )
            return  # Don't double-trigger if dispute rate already triggers

        # Check chargeback rate threshold
        chargeback_threshold = self._get_threshold(
            org, "chargeback_rate", settings.RISK_CHARGEBACK_RATE_THRESHOLD
        )
        if (
            chargeback_rate_30d is not None
            and chargeback_rate_30d > chargeback_threshold
        ):
            await self._create_review_event(
                session,
                org,
                OrganizationReviewReason.CHARGEBACK_RATE,
                {
                    "reason": "chargeback_rate",
                    "value": chargeback_rate_30d,
                    "threshold": chargeback_threshold,
                    "window": "30d",
                    "payment_count": payments_30d,
                    "chargeback_count": chargebacks_30d,
                },
            )


    async def _get_active_organization(
        self, session: AsyncSession, organization_id: UUID
    ) -> Organization | None:
        """
        Get organization if it's active and not already under review.
        Returns None if org doesn't exist, is blocked, or already under review.
        """
        from polar.organization.repository import OrganizationRepository

        repository = OrganizationRepository.from_session(session)
        org = await repository.get_by_id(organization_id, include_blocked=False)
        if org is None:
            return None

        # Skip if already under review
        if org.status in OrganizationStatus.review_statuses():
            return None

        return org

    def _should_skip_check(self, org: Organization, metric_type: str) -> bool:
        """
        Check if we should skip this risk check due to debouncing.
        Returns True if the metric was calculated within the debounce window.
        """
        risk_metrics = org.risk_metrics or {}
        metrics_30d = risk_metrics.get("30d", {})
        last_check_str = metrics_30d.get("calculated_at")

        if last_check_str:
            try:
                last_check = datetime.fromisoformat(last_check_str)
                elapsed = utc_now() - last_check
                if elapsed < timedelta(minutes=settings.RISK_CHECK_DEBOUNCE_MINUTES):
                    return True
            except (ValueError, TypeError):
                pass

        return False

    def _get_threshold(
        self, org: Organization, metric_type: str, default: float
    ) -> float:
        """
        Get the threshold for a metric type, respecting per-org overrides.
        """
        overrides = org.risk_threshold_overrides or {}
        override_data = overrides.get(metric_type)

        if override_data and isinstance(override_data, dict):
            try:
                override = ThresholdOverride.from_json(override_data)
                if not override.is_expired():
                    return override.value
            except (KeyError, ValueError, TypeError):
                pass

        return default

    async def _create_review_event(
        self,
        session: AsyncSession,
        org: Organization,
        reason: OrganizationReviewReason,
        details: OrganizationReviewDetails,
    ) -> None:
        """Create review event and move org to RISK_REVIEW."""
        repository = OrganizationReviewEventRepository.from_session(session)

        event = OrganizationReviewEvent(
            organization_id=org.id,
            review_type=OrganizationReviewType.RISK_THRESHOLD,
            reason=reason.value,
            verdict=OrganizationReviewVerdict.NEEDS_REVIEW,
            details=details,
        )
        await repository.create(event)

        if org.status == OrganizationStatus.ACTIVE:
            org.status = OrganizationStatus.RISK_REVIEW
            org.status_updated_at = utc_now()
            session.add(org)
            enqueue_job("organization.under_review", organization_id=org.id)


# Singleton instance
organization_review = OrganizationReviewService()
