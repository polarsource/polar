"""Tests for organization_review.tasks – SUBMISSION re-run + appeal review paths."""

import contextlib
from collections.abc import AsyncIterator
from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch

import pytest

from polar.models.organization import Organization, OrganizationStatus
from polar.models.organization_review import OrganizationReview
from polar.organization.repository import (
    OrganizationReviewRepository as OrgReviewRepository,
)
from polar.organization_review.schemas import (
    AgentReviewResult,
    DataSnapshot,
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
from polar.organization_review.tasks import review_appeal, run_review_agent
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

# Access the unwrapped async function to bypass the actor decorator
# which requires JobQueueManager / Redis / Dramatiq broker infrastructure.
_run_review_agent = run_review_agent.__wrapped__  # type: ignore[attr-defined]
_review_appeal = review_appeal.__wrapped__  # type: ignore[attr-defined]


def _make_agent_result(
    *,
    verdict: ReviewVerdict = ReviewVerdict.APPROVE,
    risk_level: RiskLevel = RiskLevel.LOW,
    merchant_summary: str = "Looks good",
    violated_sections: list[str] | None = None,
    model_used: str = "test-model",
) -> AgentReviewResult:
    return AgentReviewResult(
        report=ReviewAgentReport(
            verdict=verdict,
            summary="Agent summary",
            merchant_summary=merchant_summary,
            violated_sections=violated_sections or [],
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
        model_provider="openai",
        duration_seconds=1.0,
        usage=UsageInfo(),
        timed_out=False,
    )


@contextlib.asynccontextmanager
async def _mock_session_maker(
    session: AsyncSession,
) -> AsyncIterator[AsyncSession]:
    yield session


@pytest.mark.asyncio
class TestRunReviewAgentSubmission:
    """SUBMISSION re-run overwrites the existing canonical OrganizationReview
    row (grandfathered or otherwise) and clears any prior appeal state."""

    async def test_grandfathered_review_is_overwritten(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Create a grandfathered review
        org_review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.PASS,
            risk_score=0.0,
            violated_sections=[],
            reason="Grandfathered organization",
            timed_out=False,
            model_used="none",
            organization_details_snapshot={},
        )
        await save_fixture(org_review)

        original_id = org_review.id

        agent_result = _make_agent_result(
            verdict=ReviewVerdict.APPROVE,
            risk_level=RiskLevel.LOW,
            merchant_summary="New review passed",
            model_used="claude-test",
        )

        with (
            patch(
                "polar.organization_review.tasks.AsyncSessionMaker",
                return_value=_mock_session_maker(session),
            ),
            patch(
                "polar.organization_review.tasks.run_organization_review",
                new_callable=AsyncMock,
                return_value=agent_result,
            ),
        ):
            await _run_review_agent(
                organization.id,
                context=ReviewContext.SUBMISSION,
            )

        await session.flush()

        # Verify the existing record was updated, not a new one created
        repo = OrgReviewRepository.from_session(session)
        updated = await repo.get_by_organization(organization.id)

        assert updated is not None
        assert updated.id == original_id  # Same record, updated in-place
        assert updated.reason == "New review passed"
        assert updated.model_used == "claude-test"
        assert updated.risk_score == agent_result.report.overall_risk_score
        assert updated.violated_sections == []
        assert updated.timed_out is False
        assert updated.organization_details_snapshot["name"] == organization.name

    async def test_non_grandfathered_existing_review_is_overwritten(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Re-submission of an already-reviewed (non-grandfathered) org must
        # overwrite the canonical row so the new agent verdict — not the
        # stale one — becomes the source of truth.
        org_review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.PASS,
            risk_score=20.0,
            violated_sections=[],
            reason="Legitimate business",
            timed_out=False,
            model_used="claude-original",
            organization_details_snapshot={"name": "Original"},
        )
        await save_fixture(org_review)

        original_id = org_review.id

        agent_result = _make_agent_result(
            verdict=ReviewVerdict.APPROVE,
            merchant_summary="New review",
            model_used="claude-new",
        )

        with (
            patch(
                "polar.organization_review.tasks.AsyncSessionMaker",
                return_value=_mock_session_maker(session),
            ),
            patch(
                "polar.organization_review.tasks.run_organization_review",
                new_callable=AsyncMock,
                return_value=agent_result,
            ),
        ):
            await _run_review_agent(
                organization.id,
                context=ReviewContext.SUBMISSION,
            )

        await session.flush()

        repo = OrgReviewRepository.from_session(session)
        updated = await repo.get_by_organization(organization.id)

        assert updated is not None
        assert updated.id == original_id  # Same row, updated in place
        assert updated.reason == "New review"
        assert updated.model_used == "claude-new"
        assert updated.organization_details_snapshot["name"] == organization.name

    async def test_resubmit_clears_appeal_state(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Appeal fields were tied to the previous verdict. A re-submission
        # is a fresh review; the old appeal must not leak into the new state
        # (otherwise a new DENY can collide with an APPROVED appeal and the
        # org ends up DENIED while review.is_approved is still True).
        org_review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=70.0,
            violated_sections=["policy"],
            reason="Initial denial",
            timed_out=False,
            model_used="claude-original",
            organization_details_snapshot={"name": "Original"},
            appeal_submitted_at=datetime.now(UTC),
            appeal_reason="We sell digital templates, not consultancy.",
            appeal_reviewed_at=datetime.now(UTC),
            appeal_decision=OrganizationReview.AppealDecision.APPROVED,
        )
        await save_fixture(org_review)

        agent_result = _make_agent_result(
            verdict=ReviewVerdict.DENY,
            risk_level=RiskLevel.HIGH,
            merchant_summary="New violations detected",
            violated_sections=["Prohibited Products"],
            model_used="claude-new",
        )

        with (
            patch(
                "polar.organization_review.tasks.AsyncSessionMaker",
                return_value=_mock_session_maker(session),
            ),
            patch(
                "polar.organization_review.tasks.run_organization_review",
                new_callable=AsyncMock,
                return_value=agent_result,
            ),
        ):
            await _run_review_agent(
                organization.id,
                context=ReviewContext.SUBMISSION,
            )

        await session.flush()

        repo = OrgReviewRepository.from_session(session)
        updated = await repo.get_by_organization(organization.id)

        assert updated is not None
        assert updated.verdict == OrganizationReview.Verdict.FAIL
        assert updated.appeal_submitted_at is None
        assert updated.appeal_reason is None
        assert updated.appeal_reviewed_at is None
        assert updated.appeal_decision is None
        # is_approved must reflect just the new verdict, not the stale appeal
        assert updated.is_approved is False

        await session.refresh(organization)
        assert organization.status == OrganizationStatus.DENIED

    async def test_non_grandfathered_fail_resubmit_flips_org_to_denied(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # If a previously-PASS org re-submits and the agent now returns DENY,
        # both the canonical review row AND the org status update consistently.
        org_review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.PASS,
            risk_score=20.0,
            violated_sections=[],
            reason="Previously legitimate",
            timed_out=False,
            model_used="claude-original",
            organization_details_snapshot={"name": "Original"},
        )
        await save_fixture(org_review)

        agent_result = _make_agent_result(
            verdict=ReviewVerdict.DENY,
            risk_level=RiskLevel.HIGH,
            merchant_summary="Now violates AUP",
            violated_sections=["Prohibited Products"],
            model_used="claude-new",
        )

        with (
            patch(
                "polar.organization_review.tasks.AsyncSessionMaker",
                return_value=_mock_session_maker(session),
            ),
            patch(
                "polar.organization_review.tasks.run_organization_review",
                new_callable=AsyncMock,
                return_value=agent_result,
            ),
        ):
            await _run_review_agent(
                organization.id,
                context=ReviewContext.SUBMISSION,
            )

        await session.flush()

        repo = OrgReviewRepository.from_session(session)
        updated = await repo.get_by_organization(organization.id)

        assert updated is not None
        assert updated.verdict == OrganizationReview.Verdict.FAIL
        assert updated.reason == "Now violates AUP"
        assert updated.violated_sections == ["Prohibited Products"]

        await session.refresh(organization)
        assert organization.status == OrganizationStatus.DENIED

    async def test_no_existing_review_creates_new(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Ensure no review exists
        repo = OrgReviewRepository.from_session(session)
        assert await repo.get_by_organization(organization.id) is None

        agent_result = _make_agent_result(
            verdict=ReviewVerdict.APPROVE,
            merchant_summary="First review",
            model_used="claude-first",
        )

        with (
            patch(
                "polar.organization_review.tasks.AsyncSessionMaker",
                return_value=_mock_session_maker(session),
            ),
            patch(
                "polar.organization_review.tasks.run_organization_review",
                new_callable=AsyncMock,
                return_value=agent_result,
            ),
        ):
            await _run_review_agent(
                organization.id,
                context=ReviewContext.SUBMISSION,
            )

        await session.flush()

        review = await repo.get_by_organization(organization.id)

        assert review is not None
        assert review.reason == "First review"
        assert review.model_used == "claude-first"

    async def test_grandfathered_deny_updates_and_denies_org(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        # Create a grandfathered review
        org_review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.PASS,
            risk_score=0.0,
            violated_sections=[],
            reason="Grandfathered organization",
            timed_out=False,
            model_used="none",
            organization_details_snapshot={},
        )
        await save_fixture(org_review)

        original_id = org_review.id

        agent_result = _make_agent_result(
            verdict=ReviewVerdict.DENY,
            risk_level=RiskLevel.HIGH,
            merchant_summary="Policy violation detected",
            violated_sections=["Prohibited Products"],
            model_used="claude-test",
        )

        with (
            patch(
                "polar.organization_review.tasks.AsyncSessionMaker",
                return_value=_mock_session_maker(session),
            ),
            patch(
                "polar.organization_review.tasks.run_organization_review",
                new_callable=AsyncMock,
                return_value=agent_result,
            ),
        ):
            await _run_review_agent(
                organization.id,
                context=ReviewContext.SUBMISSION,
            )

        await session.flush()

        # Verify the review was updated with FAIL verdict
        repo = OrgReviewRepository.from_session(session)
        updated = await repo.get_by_organization(organization.id)

        assert updated is not None
        assert updated.id == original_id
        assert updated.verdict == OrganizationReview.Verdict.FAIL
        assert updated.reason == "Policy violation detected"
        assert updated.violated_sections == ["Prohibited Products"]

        # Verify the org was denied
        await session.refresh(organization)
        assert organization.status == OrganizationStatus.DENIED


@pytest.mark.asyncio
class TestReviewAppeal:
    async def test_approve_activates_org(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=85.0,
            violated_sections=["policy"],
            reason="Original denial",
            timed_out=False,
            model_used="test-model",
            organization_details_snapshot={},
            appeal_submitted_at=datetime.now(UTC),
            appeal_reason="We sell digital templates, not consultancy.",
        )
        await save_fixture(review)

        agent_result = _make_agent_result(
            verdict=ReviewVerdict.APPROVE,
            merchant_summary="Appeal approved",
        )

        approve_mock = AsyncMock()
        deny_mock = AsyncMock()

        with (
            patch(
                "polar.organization_review.tasks.AsyncSessionMaker",
                return_value=_mock_session_maker(session),
            ),
            patch(
                "polar.organization_review.tasks.run_organization_review",
                new_callable=AsyncMock,
                return_value=agent_result,
            ),
            patch(
                "polar.organization_review.tasks.organization_service.approve_appeal",
                approve_mock,
            ),
            patch(
                "polar.organization_review.tasks.organization_service.deny_appeal",
                deny_mock,
            ),
        ):
            await _review_appeal(organization.id)

        approve_mock.assert_awaited_once()
        deny_mock.assert_not_awaited()

    async def test_deny_rejects_appeal(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=85.0,
            violated_sections=["policy"],
            reason="Original denial",
            timed_out=False,
            model_used="test-model",
            organization_details_snapshot={},
            appeal_submitted_at=datetime.now(UTC),
            appeal_reason="please approve",
        )
        await save_fixture(review)

        agent_result = _make_agent_result(
            verdict=ReviewVerdict.DENY,
            merchant_summary="Appeal denied",
        )

        approve_mock = AsyncMock()
        deny_mock = AsyncMock()

        with (
            patch(
                "polar.organization_review.tasks.AsyncSessionMaker",
                return_value=_mock_session_maker(session),
            ),
            patch(
                "polar.organization_review.tasks.run_organization_review",
                new_callable=AsyncMock,
                return_value=agent_result,
            ),
            patch(
                "polar.organization_review.tasks.organization_service.approve_appeal",
                approve_mock,
            ),
            patch(
                "polar.organization_review.tasks.organization_service.deny_appeal",
                deny_mock,
            ),
        ):
            await _review_appeal(organization.id)

        deny_mock.assert_awaited_once()
        approve_mock.assert_not_awaited()

    async def test_no_pending_appeal_short_circuits(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        review = OrganizationReview(
            organization_id=organization.id,
            verdict=OrganizationReview.Verdict.FAIL,
            risk_score=85.0,
            violated_sections=[],
            reason="Original denial",
            timed_out=False,
            model_used="test-model",
            organization_details_snapshot={},
        )
        await save_fixture(review)

        run_mock = AsyncMock()
        with (
            patch(
                "polar.organization_review.tasks.AsyncSessionMaker",
                return_value=_mock_session_maker(session),
            ),
            patch(
                "polar.organization_review.tasks.run_organization_review",
                run_mock,
            ),
        ):
            await _review_appeal(organization.id)

        run_mock.assert_not_awaited()
