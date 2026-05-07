from datetime import UTC, datetime

import pytest

from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.payment import PaymentStatus
from polar.models.product import Product
from polar.models.product_price import ProductPriceSource
from polar.models.user import User
from polar.organization_review.report import (
    AgentReportV2,
    AnyAgentReport,
)
from polar.organization_review.repository import OrganizationReviewRepository
from polar.organization_review.schemas import (
    ActorType,
    DataSnapshot,
    DecisionType,
    DimensionAssessment,
    HistoryData,
    IdentityData,
    OrganizationData,
    PaymentMetrics,
    PayoutAccountData,
    ProductsData,
    ReviewAgentReport,
    ReviewContext,
    ReviewDimension,
    ReviewVerdict,
    RiskLevel,
    UsageInfo,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_checkout,
    create_checkout_link,
    create_customer,
    create_order,
    create_organization,
    create_payment,
    create_product,
    create_product_price_fixed,
    create_refund,
)


def _make_typed_report(
    *,
    review_type: str = "submission",
    verdict: ReviewVerdict = ReviewVerdict.APPROVE,
    risk_level: RiskLevel = RiskLevel.LOW,
    model_used: str = "test-model",
) -> AnyAgentReport:
    """Build a minimal typed agent report for tests."""
    return AgentReportV2(
        review_type=review_type,
        report=ReviewAgentReport(
            verdict=verdict,
            summary="Test summary",
            violated_sections=[],
            dimensions=[
                DimensionAssessment(
                    dimension=ReviewDimension.POLICY_COMPLIANCE,
                    risk_level=risk_level,
                    confidence=0.9,
                    findings=[],
                    recommendation="OK",
                )
            ],
            overall_risk_level=risk_level,
            recommended_action="Approve",
        ),
        data_snapshot=DataSnapshot(
            context=ReviewContext.SUBMISSION,
            organization=OrganizationData(name="Test", slug="test"),
            products=ProductsData(),
            identity=IdentityData(),
            account=PayoutAccountData(),
            metrics=PaymentMetrics(),
            history=HistoryData(),
            collected_at=datetime(2026, 1, 1, tzinfo=UTC),
        ),
        model_used=model_used,
        duration_seconds=1.0,
        usage=UsageInfo(),
    )


@pytest.mark.asyncio
class TestSaveAgentReview:
    async def test_stores_version_and_review_type(
        self,
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

        assert review.report["version"] == 2
        assert review.report["review_type"] == "submission"

    async def test_stores_model_used_from_report(
        self,
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
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        typed_report = _make_typed_report(
            review_type="threshold",
            verdict=ReviewVerdict.DENY,
            risk_level=RiskLevel.HIGH,
        )
        review = await repo.save_agent_review(
            organization_id=organization.id,
            report=typed_report,
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        assert review.report["review_type"] == "threshold"
        assert review.report["report"]["verdict"] == "DENY"
        assert review.report["report"]["overall_risk_score"] == 85.0  # HIGH
        assert review.report["duration_seconds"] == 1.0

    async def test_parsed_report_roundtrips(
        self,
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
        assert isinstance(parsed, AgentReportV2)
        assert parsed.version == 2  # V1 stored → migrated to V2 on read
        assert parsed.review_type == "manual"
        assert parsed.report.verdict == ReviewVerdict.APPROVE


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
                review_type="threshold",
                model_used="model-b",
                verdict=ReviewVerdict.DENY,
            ),
            reviewed_at=datetime(2024, 6, 1, tzinfo=UTC),
        )
        await session.flush()

        latest = await repo.get_latest_agent_review(organization.id)
        assert latest is not None
        assert latest.model_used == "model-b"
        parsed = latest.parsed_report
        assert isinstance(parsed, AgentReportV2)
        assert parsed.review_type == "threshold"


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
                risk_level=RiskLevel.LOW,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        decision = await repo.record_human_decision(
            organization_id=organization.id,
            reviewer_id=user.id,
            decision=DecisionType.APPROVE,
            reason="Looks good",
        )
        await session.flush()

        assert decision.actor_type == "human"
        assert decision.decision == "APPROVE"
        assert decision.review_context == "submission"
        assert decision.verdict == "APPROVE"
        assert decision.risk_score == 15.0  # LOW
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
                risk_level=RiskLevel.HIGH,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        decision = await repo.record_human_decision(
            organization_id=organization.id,
            reviewer_id=user.id,
            decision=DecisionType.APPROVE,
            reason="False positive",
        )
        await session.flush()

        assert decision.review_context == "threshold"
        assert decision.verdict == "DENY"
        assert decision.risk_score == 85.0  # HIGH

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
                risk_level=RiskLevel.HIGH,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        decision = await repo.record_human_decision(
            organization_id=organization.id,
            reviewer_id=user.id,
            decision=DecisionType.APPROVE,
            review_context=ReviewContext.APPEAL,
        )
        await session.flush()

        assert decision.review_context == ReviewContext.APPEAL

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
            decision=DecisionType.APPROVE,
        )
        await session.flush()

        assert decision.actor_type == ActorType.HUMAN
        assert decision.decision == DecisionType.APPROVE
        assert decision.review_context == ReviewContext.MANUAL
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
            decision=DecisionType.DENY,
        )
        await session.flush()

        second = await repo.record_human_decision(
            organization_id=organization.id,
            reviewer_id=user.id,
            decision=DecisionType.APPROVE,
            review_context=ReviewContext.APPEAL,
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
            actor_type=ActorType.AGENT,
            decision=DecisionType.APPROVE,
            review_context=ReviewContext.THRESHOLD,
            verdict=ReviewVerdict.APPROVE,
            risk_score=15.0,
        )
        await session.flush()

        assert decision.organization_id == organization.id
        assert decision.actor_type == ActorType.AGENT
        assert decision.decision == DecisionType.APPROVE
        assert decision.review_context == ReviewContext.THRESHOLD
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
                risk_level=RiskLevel.HIGH,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        decision = await repo.save_review_decision(
            organization_id=organization.id,
            actor_type=ActorType.HUMAN,
            decision=DecisionType.APPROVE,
            review_context=ReviewContext.MANUAL,
            agent_review_id=agent_review.id,
            reviewer_id=user.id,
            verdict=ReviewVerdict.DENY,
            risk_score=85.0,
            reason="Verified legitimate business",
        )
        await session.flush()

        assert decision.organization_id == organization.id
        assert decision.actor_type == ActorType.HUMAN
        assert decision.decision == DecisionType.APPROVE
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
            actor_type=ActorType.AGENT,
            decision=DecisionType.ESCALATE,
            review_context=ReviewContext.SETUP_COMPLETE,
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
            actor_type=ActorType.AGENT,
            decision=DecisionType.APPROVE,
            review_context=ReviewContext.THRESHOLD,
        )
        await session.flush()

        current = await repo.get_current_decision(organization.id)
        assert current is not None
        assert current.decision == DecisionType.APPROVE

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
            actor_type=ActorType.AGENT,
            decision=DecisionType.APPROVE,
            review_context=ReviewContext.THRESHOLD,
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
            actor_type=ActorType.AGENT,
            decision=DecisionType.APPROVE,
            review_context=ReviewContext.THRESHOLD,
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
            actor_type=ActorType.AGENT,
            decision=DecisionType.APPROVE,
            review_context=ReviewContext.THRESHOLD,
        )
        await session.flush()

        # Deactivate, then create new decision
        await repo.deactivate_current_decisions(organization.id)
        second = await repo.save_review_decision(
            organization_id=organization.id,
            actor_type=ActorType.HUMAN,
            decision=DecisionType.DENY,
            review_context=ReviewContext.MANUAL,
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
                risk_level=RiskLevel.LOW,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        decision = await repo.record_agent_decision(
            organization_id=organization.id,
            agent_review_id=agent_review.id,
            decision=DecisionType.APPROVE,
            review_context=ReviewContext.THRESHOLD,
            verdict=ReviewVerdict.APPROVE,
            risk_score=10.0,
        )
        await session.flush()

        assert decision.actor_type == ActorType.AGENT
        assert decision.decision == DecisionType.APPROVE
        assert decision.review_context == ReviewContext.THRESHOLD
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
                risk_level=RiskLevel.LOW,
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        first = await repo.record_agent_decision(
            organization_id=organization.id,
            agent_review_id=agent_review.id,
            decision=DecisionType.APPROVE,
            review_context=ReviewContext.THRESHOLD,
            verdict=ReviewVerdict.APPROVE,
        )
        await session.flush()

        second = await repo.record_agent_decision(
            organization_id=organization.id,
            agent_review_id=agent_review.id,
            decision=DecisionType.DENY,
            review_context=ReviewContext.SUBMISSION,
            verdict=ReviewVerdict.DENY,
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


@pytest.mark.asyncio
class TestGetRefundStats:
    async def test_multiple_refunds_on_same_order_counts_as_one(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """
        Split refunds (partial + remainder) on the same order should count
        as one refunded order, not inflate the refund rate.
        """
        customer = await create_customer(
            save_fixture,
            organization=organization,
            stripe_customer_id="STRIPE_CUST_SPLIT_REVIEW",
        )
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture,
            organization,
            amount=1100,
            currency="usd",
            status=PaymentStatus.succeeded,
        )
        # Partial refund
        await create_refund(
            save_fixture,
            order,
            payment,
            amount=999,
            currency="usd",
            processor_id="STRIPE_REFUND_SPLIT_1",
        )
        # Remainder refund on the same order
        await create_refund(
            save_fixture,
            order,
            payment,
            amount=101,
            currency="usd",
            processor_id="STRIPE_REFUND_SPLIT_2",
        )

        repo = OrganizationReviewRepository.from_session(session)
        count, refund_amount = await repo.get_refund_stats(organization.id)

        assert count == 1  # One order, not two refund records
        assert refund_amount == 1100  # Total amount across both refunds

    async def test_refunds_on_different_orders_counted_separately(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Refunds on different orders should each be counted."""
        customer = await create_customer(
            save_fixture,
            organization=organization,
            stripe_customer_id="STRIPE_CUST_MULTI_REVIEW",
        )
        order1 = await create_order(save_fixture, customer=customer)
        payment1 = await create_payment(
            save_fixture,
            organization,
            amount=500,
            currency="usd",
            status=PaymentStatus.succeeded,
            processor_id="STRIPE_PAY_REVIEW_1",
        )
        await create_refund(
            save_fixture,
            order1,
            payment1,
            amount=500,
            currency="usd",
            processor_id="STRIPE_REFUND_REVIEW_A",
        )

        order2 = await create_order(save_fixture, customer=customer)
        payment2 = await create_payment(
            save_fixture,
            organization,
            amount=300,
            currency="usd",
            status=PaymentStatus.succeeded,
            processor_id="STRIPE_PAY_REVIEW_2",
        )
        await create_refund(
            save_fixture,
            order2,
            payment2,
            amount=300,
            currency="usd",
            processor_id="STRIPE_REFUND_REVIEW_B",
        )

        repo = OrganizationReviewRepository.from_session(session)
        count, refund_amount = await repo.get_refund_stats(organization.id)

        assert count == 2  # Two distinct orders
        assert refund_amount == 800

    async def test_no_refunds(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        count, refund_amount = await repo.get_refund_stats(organization.id)
        assert count == 0
        assert refund_amount == 0


@pytest.mark.asyncio
class TestGetCheckoutSuccessUrls:
    async def test_returns_distinct_success_urls(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        await create_checkout(
            save_fixture,
            products=[product],
            success_url="https://example.com/thanks",
        )
        await create_checkout(
            save_fixture,
            products=[product],
            success_url="https://other.com/done",
        )
        # Duplicate — should be deduplicated
        await create_checkout(
            save_fixture,
            products=[product],
            success_url="https://example.com/thanks",
        )

        repo = OrganizationReviewRepository.from_session(session)
        urls = await repo.get_checkout_success_urls(organization.id)

        assert set(urls) == {"https://example.com/thanks", "https://other.com/done"}

    async def test_excludes_null_success_urls(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        # Checkout without success_url (default is None)
        await create_checkout(save_fixture, products=[product])
        await create_checkout(
            save_fixture,
            products=[product],
            success_url="https://example.com/thanks",
        )

        repo = OrganizationReviewRepository.from_session(session)
        urls = await repo.get_checkout_success_urls(organization.id)

        assert urls == ["https://example.com/thanks"]

    async def test_empty_when_no_checkouts(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        urls = await repo.get_checkout_success_urls(organization.id)
        assert urls == []

    async def test_excludes_deleted_checkouts(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            success_url="https://example.com/thanks",
        )
        checkout.deleted_at = datetime.now(UTC)
        await save_fixture(checkout)

        repo = OrganizationReviewRepository.from_session(session)
        urls = await repo.get_checkout_success_urls(organization.id)
        assert urls == []

    async def test_excludes_old_checkouts(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        # Recent checkout
        await create_checkout(
            save_fixture,
            products=[product],
            success_url="https://recent.com/thanks",
        )
        # Old checkout (> 3 months)
        old_checkout = await create_checkout(
            save_fixture,
            products=[product],
            success_url="https://old.com/thanks",
        )
        old_checkout.created_at = datetime(2020, 1, 1, tzinfo=UTC)
        await save_fixture(old_checkout)

        repo = OrganizationReviewRepository.from_session(session)
        urls = await repo.get_checkout_success_urls(organization.id)
        assert urls == ["https://recent.com/thanks"]


@pytest.mark.asyncio
class TestGetCheckoutReturnUrls:
    async def test_returns_distinct_return_urls(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        await create_checkout(
            save_fixture,
            products=[product],
            return_url="https://example.com/return",
        )
        await create_checkout(
            save_fixture,
            products=[product],
            return_url="https://other.com/back",
        )
        # Duplicate
        await create_checkout(
            save_fixture,
            products=[product],
            return_url="https://example.com/return",
        )

        repo = OrganizationReviewRepository.from_session(session)
        urls = await repo.get_checkout_return_urls(organization.id)

        assert set(urls) == {"https://example.com/return", "https://other.com/back"}

    async def test_excludes_null_return_urls(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        await create_checkout(save_fixture, products=[product])
        await create_checkout(
            save_fixture,
            products=[product],
            return_url="https://example.com/return",
        )

        repo = OrganizationReviewRepository.from_session(session)
        urls = await repo.get_checkout_return_urls(organization.id)

        assert urls == ["https://example.com/return"]

    async def test_empty_when_no_checkouts(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        urls = await repo.get_checkout_return_urls(organization.id)
        assert urls == []


@pytest.mark.asyncio
class TestGetCheckoutLinksWithBenefits:
    async def test_returns_checkout_links(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        await create_checkout_link(
            save_fixture,
            products=[product],
            success_url="https://example.com/thanks",
        )

        repo = OrganizationReviewRepository.from_session(session)
        links = await repo.get_checkout_links_with_benefits(organization.id)

        assert len(links) == 1
        assert links[0].success_url == "https://example.com/thanks"

    async def test_excludes_deleted_links(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
    ) -> None:
        link = await create_checkout_link(
            save_fixture,
            products=[product],
            success_url="https://example.com/thanks",
        )
        link.deleted_at = datetime.now(UTC)
        await save_fixture(link)

        repo = OrganizationReviewRepository.from_session(session)
        links = await repo.get_checkout_links_with_benefits(organization.id)
        assert links == []

    async def test_empty_when_no_links(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        links = await repo.get_checkout_links_with_benefits(organization.id)
        assert links == []


@pytest.mark.asyncio
class TestGetAdhocPriceCount:
    async def test_zero_when_no_prices(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        assert await repo.get_adhoc_price_count(organization.id) == 0

    async def test_excludes_catalog_prices(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            prices=[(1000, "usd")],
        )
        repo = OrganizationReviewRepository.from_session(session)
        assert await repo.get_adhoc_price_count(organization.id) == 0

    async def test_counts_adhoc_prices(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            prices=[(100, "usd")],  # $1 catalog product
        )
        # Two ad-hoc overrides created at checkout
        for amount in (5000, 25000):
            adhoc = await create_product_price_fixed(
                save_fixture, product=product, amount=amount, currency="usd"
            )
            adhoc.source = ProductPriceSource.ad_hoc
            await save_fixture(adhoc)

        repo = OrganizationReviewRepository.from_session(session)
        assert await repo.get_adhoc_price_count(organization.id) == 2

    async def test_excludes_archived_adhoc_prices(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=None,
            prices=[(100, "usd")],
        )
        adhoc = await create_product_price_fixed(
            save_fixture, product=product, amount=5000, currency="usd"
        )
        adhoc.source = ProductPriceSource.ad_hoc
        adhoc.is_archived = True
        await save_fixture(adhoc)

        repo = OrganizationReviewRepository.from_session(session)
        assert await repo.get_adhoc_price_count(organization.id) == 0

    async def test_scoped_to_organization(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        account_second: Account,
    ) -> None:
        # Ad-hoc price on a product from a DIFFERENT org should not be counted.
        other_org = await create_organization(save_fixture, account_second)
        other_product = await create_product(
            save_fixture,
            organization=other_org,
            recurring_interval=None,
            prices=[(100, "usd")],
        )
        adhoc = await create_product_price_fixed(
            save_fixture, product=other_product, amount=5000, currency="usd"
        )
        adhoc.source = ProductPriceSource.ad_hoc
        await save_fixture(adhoc)

        repo = OrganizationReviewRepository.from_session(session)
        assert await repo.get_adhoc_price_count(organization.id) == 0
        assert await repo.get_adhoc_price_count(other_org.id) == 1
