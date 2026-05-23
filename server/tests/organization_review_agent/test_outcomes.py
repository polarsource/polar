"""Tests for forward-outcome computation (Slice 6 part 2)."""

from __future__ import annotations

import datetime
from uuid import UUID, uuid4

import pytest

from polar.kit.utils import utc_now
from polar.models import Payment
from polar.models.organization import Organization, OrganizationStatus
from polar.models.payment import PaymentStatus
from polar.organization_review_agent.auto_action import (
    AutoActionRule,
    OutcomeMetric,
    RuleAction,
    _mean_metrics,
    evaluate_retroactive,
)
from polar.organization_review_agent.outcomes import forward_outcomes
from polar.organization_review_agent.repository import (
    OrganizationReviewAgentRunRepository,
)
from polar.models.organization_review_agent_run import (
    AgentRunStatus,
    OrganizationReviewAgentRun,
)
from polar.postgres import AsyncSession


@pytest.mark.asyncio
class TestForwardOutcomes:
    async def test_queries_execute_against_real_schema(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        """Exercises the Payment count + Refund filter + Dispute→Payment
        join against the real tables (catches column/schema drift).
        With no refunds/disputes the rates are 0; the non-zero
        arithmetic is covered by the synthetic aggregation tests
        below — Refund/Dispute require a full Order graph to seed,
        which those tests don't need."""

        since = utc_now() - datetime.timedelta(days=10)
        # 4 succeeded payments in-window, 1 before the window.
        for i in range(4):
            session.add(
                Payment(
                    organization_id=organization.id,
                    status=PaymentStatus.succeeded,
                    processor="stripe",
                    amount=1000,
                    currency="usd",
                    created_at=since + datetime.timedelta(days=1),
                    method="card",
                    processor_id=f"pi_in_{i}_{uuid4().hex[:8]}",
                )
            )
        session.add(
            Payment(
                organization_id=organization.id,
                status=PaymentStatus.succeeded,
                processor="stripe",
                amount=1000,
                currency="usd",
                created_at=since - datetime.timedelta(days=5),
                method="card",
                processor_id=f"pi_out_{uuid4().hex[:8]}",
            )
        )
        await session.flush()

        metrics = await forward_outcomes(
            session, organization.id, since=since, window_days=60
        )
        # Queries ran cleanly; no refunds/disputes seeded.
        assert metrics.refund_rate == 0.0
        assert metrics.chargeback_rate == 0.0
        assert metrics.offboard_rate == 0.0  # org is in REVIEW

    async def test_offboard_flag_for_denied_org(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        organization.status = OrganizationStatus.DENIED
        await session.flush()
        metrics = await forward_outcomes(
            session,
            organization.id,
            since=utc_now() - datetime.timedelta(days=5),
        )
        assert metrics.offboard_rate == 1.0

    async def test_no_payments_yields_zero_rates(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        metrics = await forward_outcomes(
            session,
            organization.id,
            since=utc_now() - datetime.timedelta(days=5),
        )
        assert metrics.refund_rate == 0.0
        assert metrics.chargeback_rate == 0.0


class TestMeanMetricsAggregation:
    def test_cohort_mean(self) -> None:
        oid1, oid2 = uuid4(), uuid4()
        runs = [
            OrganizationReviewAgentRun(
                organization_id=oid1, context="submission", triggered_by="x"
            ),
            OrganizationReviewAgentRun(
                organization_id=oid2, context="submission", triggered_by="x"
            ),
        ]
        outcomes = {
            oid1: OutcomeMetric(0.10, 0.20, 0.0, 0.0),
            oid2: OutcomeMetric(0.30, 0.40, 1.0, 0.0),
        }
        mean = _mean_metrics(runs, outcomes)
        assert mean.chargeback_rate == pytest.approx(0.20)
        assert mean.refund_rate == pytest.approx(0.30)
        assert mean.offboard_rate == pytest.approx(0.5)

    def test_no_outcomes_returns_zeros(self) -> None:
        runs = [
            OrganizationReviewAgentRun(
                organization_id=uuid4(),
                context="submission",
                triggered_by="x",
            )
        ]
        mean = _mean_metrics(runs, None)
        assert mean == OutcomeMetric(0.0, 0.0, 0.0, 0.0)


class TestEvaluateRetroactiveWithOutcomes:
    def test_tolerance_breach_blocks_promotion(self) -> None:
        """Matched cohort with materially worse chargebacks than control
        fails the gate even with adequate sample size."""

        now = utc_now()
        matched_orgs = [uuid4() for _ in range(30)]
        control_orgs = [uuid4() for _ in range(30)]

        def mk(oid):
            return OrganizationReviewAgentRun(
                organization_id=oid,
                context="submission",
                triggered_by="x",
                completed_at=now - datetime.timedelta(days=1),
                final_report={"verdict": "approve", "decisive_signal_kinds": []},
                org_snapshot={"status": "review"},
            )

        runs = [mk(o) for o in matched_orgs] + [mk(o) for o in control_orgs]
        # Predicate: matched = orgs in matched_orgs.
        rule = AutoActionRule(
            id="R-x",
            description="d",
            predicate=lambda r: r.organization_id in set(matched_orgs),
            action=RuleAction.AUTO_CLOSE_APPROVE,
        )
        outcomes = {
            **{o: OutcomeMetric(0.30, 0.0, 0.0, 0.0) for o in matched_orgs},
            **{o: OutcomeMetric(0.01, 0.0, 0.0, 0.0) for o in control_orgs},
        }
        report = evaluate_retroactive(
            rule, runs, outcomes=outcomes, min_sample_size=25
        )
        assert report.matched_cohort_size == 30
        assert report.control_cohort_size == 30
        assert report.promotion_eligible is False
        assert any("chargeback" in r for r in report.reasons)

    def test_within_tolerance_passes(self) -> None:
        now = utc_now()
        matched_orgs = [uuid4() for _ in range(30)]
        control_orgs = [uuid4() for _ in range(30)]

        def mk(oid):
            return OrganizationReviewAgentRun(
                organization_id=oid,
                context="submission",
                triggered_by="x",
                completed_at=now - datetime.timedelta(days=1),
            )

        runs = [mk(o) for o in matched_orgs] + [mk(o) for o in control_orgs]
        rule = AutoActionRule(
            id="R-y",
            description="d",
            predicate=lambda r: r.organization_id in set(matched_orgs),
            action=RuleAction.AUTO_CLOSE_APPROVE,
        )
        # Identical low outcomes in both cohorts → within tolerance.
        outcomes = {
            o: OutcomeMetric(0.01, 0.02, 0.0, 0.0)
            for o in matched_orgs + control_orgs
        }
        report = evaluate_retroactive(
            rule, runs, outcomes=outcomes, min_sample_size=25
        )
        assert report.promotion_eligible is True
        assert report.reasons == []
