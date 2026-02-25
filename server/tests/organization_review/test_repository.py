from datetime import UTC, datetime
from typing import Any

import pytest

from polar.models.organization import Organization
from polar.models.organization_agent_review import OrganizationAgentReview
from polar.organization_review.repository import OrganizationReviewRepository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


def _make_report(
    *,
    review_type: str | None = None,
    context: str | None = None,
) -> dict[str, Any]:
    """Build a minimal report dict.

    If review_type is given it is set as a top-level key (new format).
    If context is given it is nested under data_snapshot (legacy format).
    """
    report: dict[str, Any] = {
        "report": {"verdict": "APPROVE", "overall_risk_score": 10.0},
        "model_used": "test-model",
    }
    if review_type is not None:
        report["review_type"] = review_type
    if context is not None:
        report.setdefault("data_snapshot", {})["context"] = context
    return report


@pytest.mark.asyncio
class TestSaveAgentReview:
    async def test_stores_review_type_in_report(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        review = await repo.save_agent_review(
            organization_id=organization.id,
            review_type="submission",
            report={"report": {"verdict": "APPROVE"}},
            model_used="test-model",
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        assert review.report["review_type"] == "submission"

    async def test_does_not_mutate_original_report(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        original_report: dict[str, Any] = {"report": {"verdict": "APPROVE"}}
        repo = OrganizationReviewRepository.from_session(session)
        await repo.save_agent_review(
            organization_id=organization.id,
            review_type="setup_complete",
            report=original_report,
            model_used="test-model",
            reviewed_at=datetime.now(UTC),
        )

        # The original dict should not be modified
        assert "review_type" not in original_report

    async def test_preserves_existing_report_keys(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repo = OrganizationReviewRepository.from_session(session)
        review = await repo.save_agent_review(
            organization_id=organization.id,
            review_type="threshold",
            report={"report": {"verdict": "DENY"}, "duration_seconds": 1.5},
            model_used="test-model",
            reviewed_at=datetime.now(UTC),
        )
        await session.flush()

        assert review.report["review_type"] == "threshold"
        assert review.report["report"]["verdict"] == "DENY"
        assert review.report["duration_seconds"] == 1.5


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
        await repo.save_agent_review(
            organization_id=organization.id,
            review_type="setup_complete",
            report={"report": {"verdict": "APPROVE"}},
            model_used="test-model",
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
        await repo.save_agent_review(
            organization_id=organization.id,
            review_type="submission",
            report={"report": {"verdict": "APPROVE"}},
            model_used="test-model",
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
            report=_make_report(context="setup_complete"),
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
            review_type="submission",
            report={"report": {"verdict": "APPROVE"}},
            model_used="model-a",
            reviewed_at=datetime(2024, 1, 1, tzinfo=UTC),
        )
        await repo.save_agent_review(
            organization_id=organization.id,
            review_type="setup_complete",
            report={"report": {"verdict": "DENY"}},
            model_used="model-b",
            reviewed_at=datetime(2024, 6, 1, tzinfo=UTC),
        )
        await session.flush()

        latest = await repo.get_latest_agent_review(organization.id)
        assert latest is not None
        assert latest.model_used == "model-b"
        assert latest.report["review_type"] == "setup_complete"
