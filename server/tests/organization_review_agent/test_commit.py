"""Tests for the reviewer commit flow on AWAITING_HUMAN runs."""

from __future__ import annotations

from unittest.mock import patch
from uuid import uuid4

import pytest

from polar.models.organization import Organization
from polar.models.organization_review_agent_run import AgentRunStatus
from polar.organization_review_agent.service import (
    organization_review_agent_service,
)
from polar.postgres import AsyncSession


@pytest.mark.asyncio
class TestCommitHumanDecision:
    async def _seed_awaiting(
        self, session: AsyncSession, organization: Organization
    ):
        """Seed a run in AWAITING_HUMAN."""

        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
        run.status = AgentRunStatus.AWAITING_HUMAN
        await session.flush()
        return run

    async def test_commit_flips_to_completed_and_appends_event(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        run = await self._seed_awaiting(session, organization)
        reviewer = uuid4()

        await organization_review_agent_service.commit_human_decision(
            session,
            run,
            committed_verdict="deny",
            reviewer_user_id=reviewer,
            reviewer_reason="confirmed with payouts: merchant abandoned",
        )

        assert run.status == AgentRunStatus.COMPLETED
        assert run.completed_at is not None
        kinds = [e["kind"] for e in run.events]
        assert "human_committed" in kinds
        committed_events = [
            e for e in run.events if e["kind"] == "human_committed"
        ]
        assert committed_events[-1]["committed_verdict"] == "deny"
        assert committed_events[-1]["reviewer_user_id"] == str(reviewer)

    async def test_commit_rejects_short_reason(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        run = await self._seed_awaiting(session, organization)
        with pytest.raises(ValueError, match="≥3 chars"):
            await organization_review_agent_service.commit_human_decision(
                session,
                run,
                committed_verdict="approve",
                reviewer_user_id=uuid4(),
                reviewer_reason="ok",
            )

    async def test_commit_noop_on_non_awaiting_run(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        """Idempotent: committing an already-COMPLETED run no-ops
        instead of raising. Operators can hit the button on a stale
        page and nothing bad happens.
        """

        run = await self._seed_awaiting(session, organization)
        run.status = AgentRunStatus.COMPLETED
        await session.flush()

        # Should not raise; status stays COMPLETED.
        await organization_review_agent_service.commit_human_decision(
            session,
            run,
            committed_verdict="deny",
            reviewer_user_id=uuid4(),
            reviewer_reason="late commit",
        )
        assert run.status == AgentRunStatus.COMPLETED
        # No new human_committed event appended.
        committed_events = [
            e for e in run.events if e["kind"] == "human_committed"
        ]
        assert committed_events == []
