"""Tests for prior feedback collection, repository, prompt rendering, and schema compat."""

from datetime import UTC, datetime
from typing import Any
from unittest.mock import MagicMock, PropertyMock

import pytest

from polar.models.organization import Organization
from polar.models.organization_review_feedback import OrganizationReviewFeedback
from polar.models.user import User
from polar.organization_review.collectors.feedback import collect_feedback_data
from polar.organization_review.report import AgentReportV1, parse_agent_report
from polar.organization_review.repository import OrganizationReviewRepository
from polar.organization_review.schemas import (
    AccountData,
    DataSnapshot,
    DimensionAssessment,
    HistoryData,
    IdentityData,
    OrganizationData,
    PaymentMetrics,
    PriorFeedbackData,
    PriorFeedbackEntry,
    ProductsData,
    ReviewAgentReport,
    ReviewContext,
    ReviewDimension,
    ReviewVerdict,
    UsageInfo,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_typed_report(
    *,
    review_type: str = "submission",
    verdict: ReviewVerdict = ReviewVerdict.APPROVE,
    risk_score: float = 10.0,
    summary: str = "Test summary",
    model_used: str = "test-model",
) -> AgentReportV1:
    return AgentReportV1(
        review_type=review_type,
        report=ReviewAgentReport(
            verdict=verdict,
            overall_risk_score=risk_score,
            summary=summary,
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


def _make_snapshot(
    *,
    prior_feedback: PriorFeedbackData | None = None,
    context: ReviewContext = ReviewContext.THRESHOLD,
) -> DataSnapshot:
    return DataSnapshot(
        context=context,
        organization=OrganizationData(name="Acme", slug="acme"),
        products=ProductsData(),
        identity=IdentityData(),
        account=AccountData(),
        metrics=PaymentMetrics(),
        history=HistoryData(),
        prior_feedback=prior_feedback or PriorFeedbackData(),
        collected_at=datetime(2026, 1, 15, tzinfo=UTC),
    )


def _make_mock_feedback(
    *,
    actor_type: str = "human",
    decision: str = "APPROVE",
    review_context: str = "threshold",
    verdict: str | None = "DENY",
    risk_score: float | None = 65.0,
    reason: str | None = "Verified legitimate business",
    agent_review_id: str | None = None,
    agent_summary: str | None = None,
    created_at: datetime | None = None,
) -> OrganizationReviewFeedback:
    """Build a mock OrganizationReviewFeedback without hitting the DB."""
    fb = MagicMock(spec=OrganizationReviewFeedback)
    fb.actor_type = actor_type
    fb.decision = decision
    fb.review_context = review_context
    fb.verdict = verdict
    fb.risk_score = risk_score
    fb.reason = reason
    fb.agent_review_id = agent_review_id
    fb.created_at = created_at or datetime(2026, 1, 10, tzinfo=UTC)

    if agent_review_id and agent_summary:
        mock_report = MagicMock()
        mock_report.report.summary = agent_summary
        fb.agent_review.parsed_report = mock_report
    elif agent_review_id:
        # agent_review exists but has no parseable report
        fb.agent_review.parsed_report = MagicMock(side_effect=Exception("parse error"))

    return fb


# ---------------------------------------------------------------------------
# collect_feedback_data (pure unit tests)
# ---------------------------------------------------------------------------


class TestCollectFeedbackData:
    def test_empty_records(self) -> None:
        result = collect_feedback_data([])
        assert result.entries == []

    def test_single_human_decision(self) -> None:
        fb = _make_mock_feedback(
            actor_type="human",
            decision="APPROVE",
            review_context="threshold",
            verdict="DENY",
            risk_score=72.0,
            reason="False positive, legitimate SaaS business",
        )

        result = collect_feedback_data([fb])

        assert len(result.entries) == 1
        entry = result.entries[0]
        assert entry.actor_type == "human"
        assert entry.decision == "APPROVE"
        assert entry.review_context == "threshold"
        assert entry.verdict == "DENY"
        assert entry.risk_score == 72.0
        assert entry.reason == "False positive, legitimate SaaS business"
        assert entry.agent_summary is None  # no agent_review_id

    def test_agent_decision_with_summary(self) -> None:
        fb = _make_mock_feedback(
            actor_type="agent",
            decision="DENY",
            review_context="submission",
            verdict="DENY",
            risk_score=85.0,
            reason=None,
            agent_review_id="some-id",
            agent_summary="High risk: pricing anomalies detected",
        )

        result = collect_feedback_data([fb])

        assert len(result.entries) == 1
        assert (
            result.entries[0].agent_summary == "High risk: pricing anomalies detected"
        )

    def test_multiple_records_preserve_order(self) -> None:
        records = [
            _make_mock_feedback(
                actor_type="agent",
                decision="DENY",
                review_context="submission",
                created_at=datetime(2026, 1, 1, tzinfo=UTC),
            ),
            _make_mock_feedback(
                actor_type="human",
                decision="APPROVE",
                review_context="submission",
                reason="Approved after manual check",
                created_at=datetime(2026, 1, 2, tzinfo=UTC),
            ),
            _make_mock_feedback(
                actor_type="agent",
                decision="APPROVE",
                review_context="threshold",
                created_at=datetime(2026, 1, 15, tzinfo=UTC),
            ),
        ]

        result = collect_feedback_data(records)

        assert len(result.entries) == 3
        assert result.entries[0].review_context == "submission"
        assert result.entries[0].actor_type == "agent"
        assert result.entries[1].review_context == "submission"
        assert result.entries[1].actor_type == "human"
        assert result.entries[2].review_context == "threshold"

    def test_null_fields_default_to_unknown(self) -> None:
        fb = _make_mock_feedback()
        fb.actor_type = None
        fb.decision = None
        fb.review_context = None

        result = collect_feedback_data([fb])

        assert result.entries[0].actor_type == "unknown"
        assert result.entries[0].decision == "unknown"
        assert result.entries[0].review_context == "unknown"

    def test_agent_review_parse_error_gracefully_handled(self) -> None:
        """If the linked agent review can't be parsed, agent_summary should be None."""
        fb = _make_mock_feedback(agent_review_id="bad-id")
        # Replace agent_review with a mock whose parsed_report raises on access
        broken_review = MagicMock()
        type(broken_review).parsed_report = PropertyMock(
            side_effect=Exception("corrupt")
        )
        fb.agent_review = broken_review

        result = collect_feedback_data([fb])

        assert len(result.entries) == 1
        assert result.entries[0].agent_summary is None


# ---------------------------------------------------------------------------
# Prompt rendering (unit tests for _build_prompt)
# ---------------------------------------------------------------------------


class TestBuildPromptPriorFeedback:
    def _build(self, snapshot: DataSnapshot) -> str:
        from polar.organization_review.analyzer import ReviewAnalyzer

        analyzer = ReviewAnalyzer.__new__(ReviewAnalyzer)
        return analyzer._build_prompt(snapshot, policy_content="(policy omitted)")

    def test_no_feedback_omits_section(self) -> None:
        prompt = self._build(_make_snapshot())
        assert "Prior Review Decisions" not in prompt

    def test_feedback_renders_section_header(self) -> None:
        feedback = PriorFeedbackData(
            entries=[
                PriorFeedbackEntry(
                    actor_type="human",
                    decision="APPROVE",
                    review_context="submission",
                    created_at=datetime(2026, 1, 10, tzinfo=UTC),
                )
            ]
        )
        prompt = self._build(_make_snapshot(prior_feedback=feedback))

        assert "## Prior Review Decisions" in prompt
        assert "do NOT re-raise the same concerns" in prompt

    def test_feedback_renders_entry_details(self) -> None:
        feedback = PriorFeedbackData(
            entries=[
                PriorFeedbackEntry(
                    actor_type="human",
                    decision="APPROVE",
                    review_context="threshold",
                    verdict="DENY",
                    risk_score=72.5,
                    reason="False positive — verified SaaS business",
                    agent_summary="Pricing anomalies on product X",
                    created_at=datetime(2026, 1, 10, tzinfo=UTC),
                )
            ]
        )
        prompt = self._build(_make_snapshot(prior_feedback=feedback))

        assert "### THRESHOLD review (2026-01-10)" in prompt
        assert "- Actor: human" in prompt
        assert "- Decision: APPROVE" in prompt
        assert "- Agent Verdict: DENY" in prompt
        assert "- Agent Risk Score: 72.5" in prompt
        assert "- Agent Summary: Pricing anomalies on product X" in prompt
        assert "- Reviewer Reason: False positive — verified SaaS business" in prompt

    def test_feedback_omits_none_fields(self) -> None:
        feedback = PriorFeedbackData(
            entries=[
                PriorFeedbackEntry(
                    actor_type="agent",
                    decision="APPROVE",
                    review_context="threshold",
                    # verdict, risk_score, reason, agent_summary all None
                    created_at=datetime(2026, 1, 10, tzinfo=UTC),
                )
            ]
        )
        prompt = self._build(_make_snapshot(prior_feedback=feedback))

        assert "- Actor: agent" in prompt
        assert "Agent Verdict" not in prompt
        assert "Agent Risk Score" not in prompt
        assert "Agent Summary" not in prompt
        assert "Reviewer Reason" not in prompt

    def test_multiple_entries_rendered_chronologically(self) -> None:
        feedback = PriorFeedbackData(
            entries=[
                PriorFeedbackEntry(
                    actor_type="agent",
                    decision="DENY",
                    review_context="submission",
                    created_at=datetime(2026, 1, 1, tzinfo=UTC),
                ),
                PriorFeedbackEntry(
                    actor_type="human",
                    decision="APPROVE",
                    review_context="submission",
                    reason="Overridden",
                    created_at=datetime(2026, 1, 5, tzinfo=UTC),
                ),
            ]
        )
        prompt = self._build(_make_snapshot(prior_feedback=feedback))

        # Both entries should be present
        assert "### SUBMISSION review (2026-01-01)" in prompt
        assert "### SUBMISSION review (2026-01-05)" in prompt
        # First entry should appear before second
        pos_first = prompt.index("2026-01-01")
        pos_second = prompt.index("2026-01-05")
        assert pos_first < pos_second

    def test_unknown_date_rendered_for_none_created_at(self) -> None:
        feedback = PriorFeedbackData(
            entries=[
                PriorFeedbackEntry(
                    actor_type="agent",
                    decision="APPROVE",
                    review_context="threshold",
                    created_at=None,
                )
            ]
        )
        prompt = self._build(_make_snapshot(prior_feedback=feedback))
        assert "unknown date" in prompt

    def test_feedback_placed_before_policy(self) -> None:
        feedback = PriorFeedbackData(
            entries=[
                PriorFeedbackEntry(
                    actor_type="human",
                    decision="APPROVE",
                    review_context="threshold",
                    created_at=datetime(2026, 1, 10, tzinfo=UTC),
                )
            ]
        )
        prompt = self._build(_make_snapshot(prior_feedback=feedback))

        pos_feedback = prompt.index("## Prior Review Decisions")
        pos_policy = prompt.index("## Acceptable Use Policy")
        assert pos_feedback < pos_policy


# ---------------------------------------------------------------------------
# Schema backward compatibility
# ---------------------------------------------------------------------------


class TestPriorFeedbackSchema:
    def test_data_snapshot_defaults_to_empty_feedback(self) -> None:
        snapshot = DataSnapshot(
            context=ReviewContext.THRESHOLD,
            organization=OrganizationData(name="X", slug="x"),
            products=ProductsData(),
            identity=IdentityData(),
            account=AccountData(),
            metrics=PaymentMetrics(),
            history=HistoryData(),
            collected_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        assert snapshot.prior_feedback.entries == []

    def test_deserialize_old_jsonb_without_prior_feedback(self) -> None:
        """Existing JSONB records that lack prior_feedback should still parse."""
        old_data: dict[str, Any] = {
            "context": "threshold",
            "organization": {"name": "X", "slug": "x"},
            "products": {},
            "identity": {},
            "account": {},
            "metrics": {},
            "history": {},
            "collected_at": "2026-01-01T00:00:00+00:00",
        }
        snapshot = DataSnapshot.model_validate(old_data)
        assert snapshot.prior_feedback.entries == []

    def test_serialization_roundtrip(self) -> None:
        entry = PriorFeedbackEntry(
            actor_type="human",
            decision="APPROVE",
            review_context="threshold",
            verdict="DENY",
            risk_score=72.0,
            reason="Verified business",
            agent_summary="Some concerns",
            created_at=datetime(2026, 1, 10, tzinfo=UTC),
        )
        feedback = PriorFeedbackData(entries=[entry])
        snapshot = _make_snapshot(prior_feedback=feedback)

        dumped = snapshot.model_dump(mode="json")
        restored = DataSnapshot.model_validate(dumped)

        assert len(restored.prior_feedback.entries) == 1
        restored_entry = restored.prior_feedback.entries[0]
        assert restored_entry.actor_type == "human"
        assert restored_entry.decision == "APPROVE"
        assert restored_entry.verdict == "DENY"
        assert restored_entry.risk_score == 72.0
        assert restored_entry.reason == "Verified business"
        assert restored_entry.agent_summary == "Some concerns"

    def test_v1_report_roundtrip_with_prior_feedback(self) -> None:
        """AgentReportV1 with prior_feedback in DataSnapshot roundtrips correctly."""
        entry = PriorFeedbackEntry(
            actor_type="human",
            decision="APPROVE",
            review_context="threshold",
            reason="Verified",
            created_at=datetime(2026, 1, 10, tzinfo=UTC),
        )
        snapshot = _make_snapshot(prior_feedback=PriorFeedbackData(entries=[entry]))

        report = AgentReportV1(
            review_type="threshold",
            report=ReviewAgentReport(
                verdict=ReviewVerdict.APPROVE,
                overall_risk_score=15.0,
                summary="Low risk",
                violated_sections=[],
                dimensions=[
                    DimensionAssessment(
                        dimension=ReviewDimension.POLICY_COMPLIANCE,
                        score=10.0,
                        confidence=0.9,
                        findings=[],
                        recommendation="OK",
                    )
                ],
                recommended_action="Approve",
            ),
            data_snapshot=snapshot,
            model_used="test",
            duration_seconds=1.0,
        )

        dumped = report.model_dump(mode="json")
        parsed = parse_agent_report(dumped)

        assert len(parsed.data_snapshot.prior_feedback.entries) == 1
        assert parsed.data_snapshot.prior_feedback.entries[0].reason == "Verified"


# ---------------------------------------------------------------------------
# Repository: get_feedback_history (integration tests)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestGetFeedbackHistory:
    async def test_returns_empty_when_no_feedback(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        result = await repo.get_feedback_history(organization.id)
        assert result == []

    async def test_returns_feedback_ordered_by_created_at(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)

        # Create two decisions in reverse chronological order
        second = await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="human",
            decision="APPROVE",
            review_context="threshold",
            reviewer_id=user.id,
            reason="Looks good",
        )
        await session.flush()

        first = await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="agent",
            decision="DENY",
            review_context="submission",
            is_current=False,
        )
        await session.flush()

        # Force first to be older
        first.created_at = datetime(2025, 1, 1, tzinfo=UTC)
        second.created_at = datetime(2026, 1, 1, tzinfo=UTC)
        await session.flush()

        history = await repo.get_feedback_history(organization.id)

        assert len(history) == 2
        assert history[0].created_at < history[1].created_at
        assert history[0].decision == "DENY"
        assert history[1].decision == "APPROVE"

    async def test_includes_linked_agent_review(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)

        agent_review = await repo.save_agent_review(
            organization_id=organization.id,
            report=_make_typed_report(
                review_type="submission",
                verdict=ReviewVerdict.DENY,
                risk_score=80.0,
                summary="High risk: prohibited content detected",
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="agent",
            decision="DENY",
            review_context="submission",
            agent_review_id=agent_review.id,
            verdict="DENY",
            risk_score=80.0,
        )
        await session.flush()

        history = await repo.get_feedback_history(organization.id)

        assert len(history) == 1
        fb = history[0]
        assert fb.agent_review_id == agent_review.id
        # agent_review should be eagerly loaded (no lazy raise)
        assert fb.agent_review is not None
        assert fb.agent_review.parsed_report.report.summary == (
            "High risk: prohibited content detected"
        )

    async def test_excludes_deleted_feedback(
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

        # Soft-delete
        decision.deleted_at = datetime.now(UTC)
        await session.flush()

        history = await repo.get_feedback_history(organization.id)
        assert history == []

    async def test_scoped_to_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)

        await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="agent",
            decision="APPROVE",
            review_context="threshold",
        )
        await repo.save_review_decision(
            organization_id=organization_second.id,
            actor_type="agent",
            decision="DENY",
            review_context="submission",
        )
        await session.flush()

        history = await repo.get_feedback_history(organization.id)

        assert len(history) == 1
        assert history[0].organization_id == organization.id


# ---------------------------------------------------------------------------
# End-to-end: collect_feedback_data + real DB records
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
class TestCollectFeedbackDataIntegration:
    async def test_full_pipeline(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        """Fetch from DB → transform via collector → verify schema output."""
        repo = OrganizationReviewRepository.from_session(session)

        # Create agent review
        agent_review = await repo.save_agent_review(
            organization_id=organization.id,
            report=_make_typed_report(
                review_type="submission",
                verdict=ReviewVerdict.DENY,
                risk_score=75.0,
                summary="Suspicious pricing patterns",
            ),
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        # Agent decision
        await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="agent",
            decision="DENY",
            review_context="submission",
            agent_review_id=agent_review.id,
            verdict="DENY",
            risk_score=75.0,
            is_current=False,
        )
        await session.flush()

        # Human override
        await repo.save_review_decision(
            organization_id=organization.id,
            actor_type="human",
            decision="APPROVE",
            review_context="submission",
            agent_review_id=agent_review.id,
            reviewer_id=user.id,
            verdict="DENY",
            risk_score=75.0,
            reason="Reviewed pricing, it's legitimate for enterprise SaaS",
        )
        await session.flush()

        # Fetch and transform
        records = await repo.get_feedback_history(organization.id)
        result = collect_feedback_data(records)

        assert len(result.entries) == 2

        agent_entry = result.entries[0]
        assert agent_entry.actor_type == "agent"
        assert agent_entry.decision == "DENY"
        assert agent_entry.agent_summary == "Suspicious pricing patterns"

        human_entry = result.entries[1]
        assert human_entry.actor_type == "human"
        assert human_entry.decision == "APPROVE"
        assert human_entry.reason == (
            "Reviewed pricing, it's legitimate for enterprise SaaS"
        )
        assert human_entry.agent_summary == "Suspicious pricing patterns"
