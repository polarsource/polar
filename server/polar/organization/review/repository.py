from datetime import timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import Select, and_, case, func, select, text

from polar.kit.db.postgres import AsyncSession
from polar.kit.repository import RepositoryBase
from polar.models import Dispute, OrganizationReviewEvent, Payment, Refund
from polar.models.dispute import DisputeStatus
from polar.models.organization_review_event import OrganizationReviewType
from polar.models.payment import PaymentStatus
from polar.models.refund import RefundStatus


class OrganizationReviewEventRepository(RepositoryBase[OrganizationReviewEvent]):
    model = OrganizationReviewEvent

    def get_by_organization_statement(
        self, organization_id: UUID
    ) -> Select[tuple[OrganizationReviewEvent]]:
        return self.get_base_statement().where(
            OrganizationReviewEvent.organization_id == organization_id,
            OrganizationReviewEvent.deleted_at.is_(None),
        )

    async def get_latest_by_organization(
        self, organization_id: UUID
    ) -> OrganizationReviewEvent | None:
        statement = (
            self.get_by_organization_statement(organization_id)
            .order_by(OrganizationReviewEvent.created_at.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def get_latest_risk_trigger(
        self, organization_id: UUID
    ) -> OrganizationReviewEvent | None:
        statement = (
            self.get_by_organization_statement(organization_id)
            .where(OrganizationReviewEvent.review_type == OrganizationReviewType.RISK_THRESHOLD)
            .order_by(OrganizationReviewEvent.created_at.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)


class RiskMetricsRepository:
    """Repository for calculating risk metrics from payment/refund/dispute data."""

    def __init__(self, session: "AsyncSession") -> None:
        self.session = session

    async def calculate_payment_metrics(
        self, organization_id: UUID
    ) -> tuple[int, int, int, int, float | None]:
        """
        Calculate all payment-related metrics in a single query.

        Returns:
            (attempts_30d, successes_30d, attempts_all_time, successes_all_time, p90_risk_score)
        """
        now = func.now()
        thirty_days_ago = now - timedelta(days=30)

        statement = select(
            # 30-day stats
            func.count(case((Payment.created_at >= thirty_days_ago, 1))).label(
                "attempts_30d"
            ),
            func.count(
                case(
                    (
                        and_(
                            Payment.created_at >= thirty_days_ago,
                            Payment.status == PaymentStatus.succeeded,
                        ),
                        1,
                    )
                )
            ).label("successes_30d"),
            # All-time stats
            func.count().label("attempts_all_time"),
            func.count(case((Payment.status == PaymentStatus.succeeded, 1))).label(
                "successes_all_time"
            ),
            # P90 risk score for successful payments in last 30 days
            func.percentile_cont(0.9)
            .within_group(Payment.risk_score)
            .filter(
                and_(
                    Payment.created_at >= thirty_days_ago,
                    Payment.status == PaymentStatus.succeeded,
                    Payment.risk_score.is_not(None),
                )
            )
            .label("p90_risk"),
        ).where(
            Payment.organization_id == organization_id,
            Payment.deleted_at.is_(None),
        )

        result = await self.session.execute(statement)
        row = result.one()
        return (
            row.attempts_30d,
            row.successes_30d,
            row.attempts_all_time,
            row.successes_all_time,
            row.p90_risk,
        )

    async def calculate_refund_rate_stats(
        self, organization_id: UUID
    ) -> tuple[int, int, int, int]:
        """
        Calculate refund rate stats.

        Returns:
            (payments_30d, refunds_30d, payments_all_time, refunds_all_time)
        """
        now = func.now()
        thirty_days_ago = now - timedelta(days=30)

        # Get successful payment counts
        payment_statement = select(
            func.count(
                case(
                    (
                        and_(
                            Payment.created_at >= thirty_days_ago,
                            Payment.status == PaymentStatus.succeeded,
                        ),
                        1,
                    )
                )
            ).label("payments_30d"),
            func.count(case((Payment.status == PaymentStatus.succeeded, 1))).label(
                "payments_all_time"
            ),
        ).where(
            Payment.organization_id == organization_id,
            Payment.deleted_at.is_(None),
        )

        payment_result = await self.session.execute(payment_statement)
        payment_row = payment_result.one()

        # Get refund counts
        refund_statement = select(
            func.count(case((Refund.created_at >= thirty_days_ago, 1))).label(
                "refunds_30d"
            ),
            func.count().label("refunds_all_time"),
        ).where(
            Refund.organization_id == organization_id,
            Refund.status == RefundStatus.succeeded,
            Refund.deleted_at.is_(None),
        )

        refund_result = await self.session.execute(refund_statement)
        refund_row = refund_result.one()

        return (
            payment_row.payments_30d,
            refund_row.refunds_30d,
            payment_row.payments_all_time,
            refund_row.refunds_all_time,
        )


    async def calculate_dispute_stats(
        self, organization_id: UUID
    ) -> tuple[int, int, int, int, int, int]:
        """
        Calculate dispute and chargeback rates.

        Disputes with status 'prevented' or 'early_warning' are NOT chargebacks.
        Everything else is an actual chargeback.

        Returns:
            (payments_30d, disputes_30d, chargebacks_30d, payments_all_time,
             disputes_all_time, chargebacks_all_time)
        """
        from polar.models import Customer, Order

        now = func.now()
        thirty_days_ago = now - timedelta(days=30)

        # Chargebacks are disputes NOT in prevented or early_warning status
        chargeback_statuses = {DisputeStatus.prevented, DisputeStatus.early_warning}

        # Get payment counts
        payment_statement = select(
            func.count(
                case(
                    (
                        and_(
                            Payment.created_at >= thirty_days_ago,
                            Payment.status == PaymentStatus.succeeded,
                        ),
                        1,
                    )
                )
            ).label("payments_30d"),
            func.count(case((Payment.status == PaymentStatus.succeeded, 1))).label(
                "payments_all_time"
            ),
        ).where(
            Payment.organization_id == organization_id,
            Payment.deleted_at.is_(None),
        )

        payment_result = await self.session.execute(payment_statement)
        payment_row = payment_result.one()

        # Get dispute counts via Order -> Customer -> organization_id
        dispute_statement = (
            select(
                func.count(case((Dispute.created_at >= thirty_days_ago, 1))).label(
                    "disputes_30d"
                ),
                func.count(
                    case(
                        (
                            and_(
                                Dispute.created_at >= thirty_days_ago,
                                Dispute.status.not_in(chargeback_statuses),
                            ),
                            1,
                        )
                    )
                ).label("chargebacks_30d"),
                func.count().label("disputes_all_time"),
                func.count(case((Dispute.status.not_in(chargeback_statuses), 1))).label(
                    "chargebacks_all_time"
                ),
            )
            .select_from(Dispute)
            .join(Order, Dispute.order_id == Order.id)
            .join(Customer, Order.customer_id == Customer.id)
            .where(
                Customer.organization_id == organization_id,
                Dispute.deleted_at.is_(None),
            )
        )

        dispute_result = await self.session.execute(dispute_statement)
        dispute_row = dispute_result.one()

        return (
            payment_row.payments_30d,
            dispute_row.disputes_30d,
            dispute_row.chargebacks_30d,
            payment_row.payments_all_time,
            dispute_row.disputes_all_time,
            dispute_row.chargebacks_all_time,
        )

    async def update_risk_metrics(
        self,
        organization_id: UUID,
        stats_30d: dict[str, Any],
        stats_all_time: dict[str, Any],
    ) -> None:
        """
        Atomic JSONB update of risk_metrics on organization.
        Uses jsonb_set to avoid row locks during calculation.
        """
        import json

        await self.session.execute(
            text("""
                UPDATE organizations
                SET risk_metrics = jsonb_set(
                    jsonb_set(
                        COALESCE(risk_metrics, '{}'),
                        '{30d}',
                        COALESCE(risk_metrics->'30d', '{}') || :stats_30d::jsonb
                    ),
                    '{all_time}',
                    COALESCE(risk_metrics->'all_time', '{}') || :stats_all::jsonb
                ),
                modified_at = NOW()
                WHERE id = :org_id
            """),
            {
                "org_id": organization_id,
                "stats_30d": json.dumps(stats_30d),
                "stats_all": json.dumps(stats_all_time),
            },
        )
