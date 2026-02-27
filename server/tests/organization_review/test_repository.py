from datetime import UTC, datetime
from typing import Any

import pytest

from polar.models.organization import Organization
from polar.models.organization_agent_review import OrganizationAgentReview
from polar.models.payment import PaymentStatus
from polar.models.user import User
from polar.organization_review.report import AgentReportV1
from polar.organization_review.repository import OrganizationReviewRepository
from polar.organization_review.schemas import (
    AccountData,
    DataSnapshot,
    DimensionAssessment,
    HistoryData,
    IdentityData,
    OrganizationData,
    PaymentMetrics,
    ProductsData,
    ReviewAgentReport,
    ReviewContext,
    ReviewDimension,
    ReviewVerdict,
    UsageInfo,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_payment


def _make_typed_report(
    *,
    review_type: str = "submission",
    verdict: ReviewVerdict = ReviewVerdict.APPROVE,
    risk_score: float = 10.0,
    model_used: str = "test-model",
) -> AgentReportV1:
    """Build a minimal typed agent report for tests."""
    return AgentReportV1(
        review_type=review_type,
        report=ReviewAgentReport(
            verdict=verdict,
            overall_risk_score=risk_score,
            summary="Test summary",
            violated_sections=[],
            dimensions=[
                DimensionAssessment(
                    dimension=ReviewDimension.POLICY_COMPLIANCE,
                    score=risk_score,
                    confidence=0.9,
                    findings=[],
                    recommendation="OK",
                )
            ],
            recommended_action="Approve",
        ),
        data_snapshot=DataSnapshot(
            context=ReviewContext.SUBMISSION,
            organization=OrganizationData(name="Test", slug="test"),
            products=ProductsData(),
            identity=IdentityData(),
            account=AccountData(),
            metrics=PaymentMetrics(),
            history=HistoryData(),
            collected_at=datetime(2026, 1, 1, tzinfo=UTC),
        ),
        model_used=model_used,
        duration_seconds=1.0,
        usage=UsageInfo(),
    )


def _make_legacy_report(
    *,
    context: str | None = None,
) -> dict[str, Any]:
    """Build a legacy (pre-versioning) report dict for backward-compat tests.

    If context is given it is nested under data_snapshot (old format).
    """
    report: dict[str, Any] = {
        "report": {"verdict": "APPROVE", "overall_risk_score": 10.0},
        "model_used": "test-model",
    }
    if context is not None:
        report.setdefault("data_snapshot", {})["context"] = context
    return report


@pytest.mark.asyncio
class TestSaveAgentReview:
    async def test_stores_version_and_review_type(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        typed_report = _make_typed_report(review_type="submission")
        review = await repo.save_agent_review(
            organization_id=organization.id,
            report=typed_report,
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        assert review.report["version"] == 1
        assert review.report["review_type"] == "submission"

    async def test_stores_model_used_from_report(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        typed_report = _make_typed_report(model_used="gpt-4o-mini")
        review = await repo.save_agent_review(
            organization_id=organization.id,
            report=typed_report,
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        assert review.model_used == "gpt-4o-mini"

    async def test_preserves_all_report_keys(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        typed_report = _make_typed_report(
            review_type="threshold",
            verdict=ReviewVerdict.DENY,
            risk_score=75.0,
        )
        review = await repo.save_agent_review(
            organization_id=organization.id,
            report=typed_report,
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        assert review.report["review_type"] == "threshold"
        assert review.report["report"]["verdict"] == "DENY"
        assert review.report["report"]["overall_risk_score"] == 75.0
        assert review.report["duration_seconds"] == 1.0

    async def test_parsed_report_roundtrips(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """saved report can be parsed back into a typed schema."""
        repo = OrganizationReviewRepository.from_session(session)
        typed_report = _make_typed_report(review_type="manual")
        review = await repo.save_agent_review(
            organization_id=organization.id,
            report=typed_report,
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        parsed = review.parsed_report
        assert parsed.version == 1
        assert parsed.review_type == "manual"
        assert parsed.report.verdict == ReviewVerdict.APPROVE


@pytest.mark.asyncio
class TestHasSetupCompleteReview:
    async def test_returns_true_for_new_format(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """New records with top-level review_type are found."""
        repo = OrganizationReviewRepository.from_session(session)
        typed_report = _make_typed_report(review_type="setup_complete")
        await repo.save_agent_review(
            organization_id=organization.id,
            report=typed_report,
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        assert await repo.has_setup_complete_review(organization.id) is True

    async def test_returns_false_for_other_type(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        typed_report = _make_typed_report(review_type="submission")
        await repo.save_agent_review(
            organization_id=organization.id,
            report=typed_report,
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        assert await repo.has_setup_complete_review(organization.id) is False

    async def test_returns_false_when_no_reviews(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        assert await repo.has_setup_complete_review(organization.id) is False

    async def test_legacy_records_without_review_type(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Old records that only have data_snapshot.context are NOT matched.

        This verifies we don't break on legacy data — they simply won't match
        the new query, which is the expected behavior.
        """
        legacy_review = OrganizationAgentReview(
            organization_id=organization.id,
            report=_make_legacy_report(context="setup_complete"),
            model_used="test-model",
            reviewed_at=datetime.now(UTC),
        )
        await save_fixture(legacy_review)

        repo = OrganizationReviewRepository.from_session(session)
        # Legacy record without top-level review_type won't match
        assert await repo.has_setup_complete_review(organization.id) is False


@pytest.mark.asyncio
class TestGetLatestAgentReview:
    async def test_returns_latest_by_reviewed_at(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)

        await repo.save_agent_review(
            organization_id=organization.id,
            report=_make_typed_report(review_type="submission", model_used="model-a"),
            reviewed_at=datetime(2024, 1, 1, tzinfo=UTC),
        )
        await repo.save_agent_review(
            organization_id=organization.id,
            report=_make_typed_report(
                review_type="setup_complete",
                model_used="model-b",
                verdict=ReviewVerdict.DENY,
            ),
            reviewed_at=datetime(2024, 6, 1, tzinfo=UTC),
        )
        await session.flush()

        latest = await repo.get_latest_agent_review(organization.id)
        assert latest is not None
        assert latest.model_used == "model-b"
        assert latest.parsed_report.review_type == "setup_complete"


@pytest.mark.asyncio
class TestRecordHumanDecision:
    async def test_derives_context_from_agent_review(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        """review_context is derived from the agent review's review_type."""
        repo = OrganizationReviewRepository.from_session(session)
        await repo.save_agent_review(
            organization_id=organization.id,
            report=_make_typed_report(
                review_type="submission",
                verdict=ReviewVerdict.APPROVE,
                risk_score=12.0,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        decision = await repo.record_human_decision(
            organization_id=organization.id,
            reviewer_id=user.id,
            decision="APPROVE",
            reason="Looks good",
        )
        await session.flush()

        assert decision.actor_type == "human"
        assert decision.decision == "APPROVE"
        assert decision.review_context == "submission"
        assert decision.verdict == "APPROVE"
        assert decision.risk_score == 12.0
        assert decision.reason == "Looks good"
        assert decision.is_current is True

    async def test_with_agent_review_override(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        """Human overrides AI DENY verdict to APPROVE."""
        repo = OrganizationReviewRepository.from_session(session)
        await repo.save_agent_review(
            organization_id=organization.id,
            report=_make_typed_report(
                review_type="threshold",
                verdict=ReviewVerdict.DENY,
                risk_score=78.0,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        decision = await repo.record_human_decision(
            organization_id=organization.id,
            reviewer_id=user.id,
            decision="APPROVE",
            reason="False positive",
        )
        await session.flush()

        assert decision.review_context == "threshold"
        assert decision.verdict == "DENY"
        assert decision.risk_score == 78.0

    async def test_explicit_context_overrides_agent_review(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        """Explicit review_context takes precedence over agent review."""
        repo = OrganizationReviewRepository.from_session(session)
        await repo.save_agent_review(
            organization_id=organization.id,
            report=_make_typed_report(
                review_type="submission",
                verdict=ReviewVerdict.DENY,
                risk_score=80.0,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        decision = await repo.record_human_decision(
            organization_id=organization.id,
            reviewer_id=user.id,
            decision="APPROVE",
            review_context="appeal",
        )
        await session.flush()

        assert decision.review_context == "appeal"

    async def test_without_agent_review(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        """Falls back to 'manual' when no agent review exists."""
        repo = OrganizationReviewRepository.from_session(session)
        decision = await repo.record_human_decision(
            organization_id=organization.id,
            reviewer_id=user.id,
            decision="APPROVE",
        )
        await session.flush()

        assert decision.actor_type == "human"
        assert decision.decision == "APPROVE"
        assert decision.review_context == "manual"
        assert decision.agent_review_id is None
        assert decision.verdict is None
        assert decision.risk_score is None
        assert decision.is_current is True

    async def test_deactivates_previous_decision(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        """New human decision deactivates the previous one."""
        repo = OrganizationReviewRepository.from_session(session)
        first = await repo.record_human_decision(
            organization_id=organization.id,
            reviewer_id=user.id,
            decision="DENY",
        )
        await session.flush()

        second = await repo.record_human_decision(
            organization_id=organization.id,
            reviewer_id=user.id,
            decision="APPROVE",
            review_context="appeal",
        )
        await session.flush()

        await session.refresh(first)
        assert first.is_current is False
        assert second.is_current is True


@pytest.mark.asyncio
class TestSaveReviewDecision:
    async def test_agent_decision(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        decision = await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="agent",
            decision="APPROVE",
            review_context="threshold",
            verdict="APPROVE",
            risk_score=15.0,
        )
        await session.flush()

        assert decision.organization_id == organization.id
        assert decision.actor_type == "agent"
        assert decision.decision == "APPROVE"
        assert decision.review_context == "threshold"
        assert decision.verdict == "APPROVE"
        assert decision.risk_score == 15.0
        assert decision.reviewer_id is None
        assert decision.is_current is True

    async def test_human_decision(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)

        # Create an agent review first
        agent_review = await repo.save_agent_review(
            organization_id=organization.id,
            report=_make_typed_report(
                review_type="submission",
                verdict=ReviewVerdict.DENY,
                risk_score=85.0,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        decision = await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="human",
            decision="APPROVE",
            review_context="manual",
            agent_review_id=agent_review.id,
            reviewer_id=user.id,
            verdict="DENY",
            risk_score=85.0,
            reason="Verified legitimate business",
        )
        await session.flush()

        assert decision.organization_id == organization.id
        assert decision.actor_type == "human"
        assert decision.decision == "APPROVE"
        assert decision.reviewer_id == user.id
        assert decision.agent_review_id == agent_review.id
        assert decision.verdict == "DENY"
        assert decision.reason == "Verified legitimate business"
        assert decision.is_current is True

    async def test_is_current_defaults_to_true(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        decision = await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="agent",
            decision="ESCALATE",
            review_context="setup_complete",
        )
        await session.flush()

        assert decision.is_current is True


@pytest.mark.asyncio
class TestGetCurrentDecision:
    async def test_returns_decision_when_exists(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="agent",
            decision="APPROVE",
            review_context="threshold",
        )
        await session.flush()

        current = await repo.get_current_decision(organization.id)
        assert current is not None
        assert current.decision == "APPROVE"

    async def test_returns_none_when_no_decision(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        current = await repo.get_current_decision(organization.id)
        assert current is None

    async def test_returns_none_for_non_current(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="agent",
            decision="APPROVE",
            review_context="threshold",
            is_current=False,
        )
        await session.flush()

        current = await repo.get_current_decision(organization.id)
        assert current is None


@pytest.mark.asyncio
class TestDeactivateCurrentDecisions:
    async def test_deactivates_existing_current(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        decision = await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="agent",
            decision="APPROVE",
            review_context="threshold",
        )
        await session.flush()
        assert decision.is_current is True

        await repo.deactivate_current_decisions(organization.id)
        # Need to expire cached attributes to see the DB change
        await session.refresh(decision)
        assert decision.is_current is False

    async def test_noop_when_no_current(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        # Should not raise
        await repo.deactivate_current_decisions(organization.id)

    async def test_new_decision_after_deactivation(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)

        # First decision
        first = await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="agent",
            decision="APPROVE",
            review_context="threshold",
        )
        await session.flush()

        # Deactivate, then create new decision
        await repo.deactivate_current_decisions(organization.id)
        second = await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="human",
            decision="DENY",
            review_context="manual",
        )
        await session.flush()

        await session.refresh(first)
        assert first.is_current is False
        assert second.is_current is True

        # get_current_decision should return the new one
        current = await repo.get_current_decision(organization.id)
        assert current is not None
        assert current.id == second.id


@pytest.mark.asyncio
class TestRecordAgentDecision:
    async def test_creates_decision_with_correct_fields(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        agent_review = await repo.save_agent_review(
            organization_id=organization.id,
            report=_make_typed_report(
                review_type="threshold",
                verdict=ReviewVerdict.APPROVE,
                risk_score=10.0,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        decision = await repo.record_agent_decision(
            organization_id=organization.id,
            agent_review_id=agent_review.id,
            decision="APPROVE",
            review_context="threshold",
            verdict="APPROVE",
            risk_score=10.0,
        )
        await session.flush()

        assert decision.actor_type == "agent"
        assert decision.decision == "APPROVE"
        assert decision.review_context == "threshold"
        assert decision.verdict == "APPROVE"
        assert decision.risk_score == 10.0
        assert decision.agent_review_id == agent_review.id
        assert decision.is_current is True

    async def test_deactivates_previous_decision(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        agent_review = await repo.save_agent_review(
            organization_id=organization.id,
            report=_make_typed_report(
                review_type="threshold",
                verdict=ReviewVerdict.APPROVE,
                risk_score=10.0,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        first = await repo.record_agent_decision(
            organization_id=organization.id,
            agent_review_id=agent_review.id,
            decision="APPROVE",
            review_context="threshold",
            verdict="APPROVE",
        )
        await session.flush()

        second = await repo.record_agent_decision(
            organization_id=organization.id,
            agent_review_id=agent_review.id,
            decision="DENY",
            review_context="submission",
            verdict="DENY",
        )
        await session.flush()

        await session.refresh(first)
        assert first.is_current is False
        assert second.is_current is True


@pytest.mark.asyncio
class TestGetRiskScorePercentiles:
    async def test_no_payments(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Returns (None, None) when no succeeded payments with risk scores exist."""
        repo = OrganizationReviewRepository.from_session(session)
        p50, p90 = await repo.get_risk_score_percentiles(organization.id)
        assert p50 is None
        assert p90 is None

    async def test_single_payment(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Single score returns the same value for both percentiles."""
        await create_payment(
            save_fixture, organization, risk_score=42, status=PaymentStatus.succeeded
        )
        repo = OrganizationReviewRepository.from_session(session)
        p50, p90 = await repo.get_risk_score_percentiles(organization.id)
        assert p50 == 42
        assert p90 == 42

    async def test_multiple_payments(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Percentiles computed over 10 scores: 1..10."""
        for score in range(1, 11):
            await create_payment(
                save_fixture,
                organization,
                risk_score=score,
                status=PaymentStatus.succeeded,
            )
        repo = OrganizationReviewRepository.from_session(session)
        p50, p90 = await repo.get_risk_score_percentiles(organization.id)
        # percentile_cont(0.5) over [1..10] = 5.5 → int = 5
        assert p50 == 5
        # percentile_cont(0.9) over [1..10] = 9.1 → int = 9
        assert p90 == 9

    async def test_excludes_null_risk_scores(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Payments with risk_score=None are excluded from the calculation."""
        await create_payment(
            save_fixture, organization, risk_score=10, status=PaymentStatus.succeeded
        )
        await create_payment(
            save_fixture, organization, risk_score=None, status=PaymentStatus.succeeded
        )
        await create_payment(
            save_fixture, organization, risk_score=90, status=PaymentStatus.succeeded
        )
        repo = OrganizationReviewRepository.from_session(session)
        p50, p90 = await repo.get_risk_score_percentiles(organization.id)
        # Only [10, 90] → p50 = 50, p90 = 82
        assert p50 == 50
        assert p90 == 82

    async def test_excludes_non_succeeded_payments(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Only succeeded payments contribute to the percentile."""
        await create_payment(
            save_fixture, organization, risk_score=99, status=PaymentStatus.failed
        )
        await create_payment(
            save_fixture, organization, risk_score=20, status=PaymentStatus.succeeded
        )
        repo = OrganizationReviewRepository.from_session(session)
        p50, p90 = await repo.get_risk_score_percentiles(organization.id)
        # Only [20]
        assert p50 == 20
        assert p90 == 20

    async def test_skewed_distribution(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Heavily skewed: many low scores with one outlier."""
        for _ in range(9):
            await create_payment(
                save_fixture,
                organization,
                risk_score=1,
                status=PaymentStatus.succeeded,
            )
        await create_payment(
            save_fixture, organization, risk_score=100, status=PaymentStatus.succeeded
        )
        repo = OrganizationReviewRepository.from_session(session)
        p50, p90 = await repo.get_risk_score_percentiles(organization.id)
        # [1,1,1,1,1,1,1,1,1,100]: p50=1, p90=int(10.9)=10
        assert p50 == 1
        assert p90 == 10
