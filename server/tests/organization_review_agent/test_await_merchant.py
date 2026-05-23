"""Tests for the await_merchant SLA contract + scanner."""

from __future__ import annotations

import datetime
from unittest.mock import patch
from uuid import uuid4

import pytest

from polar.kit.utils import utc_now
from polar.models.organization import Organization
from polar.models.organization_review_agent_run import AgentRunStatus
from polar.models.user import User
from polar.organization_review_agent.repository import (
    OrganizationReviewAgentRunRepository,
)
from polar.organization_review_agent.service import (
    organization_review_agent_service,
)
from polar.organization_review_agent.tasks import (
    _apply_sla_timeout_action,
)
from polar.postgres import AsyncSession


@pytest.mark.asyncio
class TestParkForMerchant:
    async def _seed_awaiting(
        self, session: AsyncSession, organization: Organization
    ):
        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
        run.status = AgentRunStatus.AWAITING_HUMAN
        await session.flush()
        return run

    async def test_sets_due_at_and_on_timeout(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        run = await self._seed_awaiting(session, organization)
        before = utc_now()

        await organization_review_agent_service.park_for_merchant(
            session,
            run,
            days=7,
            on_timeout="escalate",
            reviewer_user_id=uuid4(),
            reviewer_reason="asked merchant to verify payouts",
            plain_thread_id="thr_abc",
        )

        assert run.due_at is not None
        assert run.due_at > before
        assert run.due_at < before + datetime.timedelta(days=7, hours=1)
        assert run.on_timeout == "escalate"
        assert run.plain_thread_id == "thr_abc"
        kinds = [e["kind"] for e in run.events]
        assert "await_merchant_armed" in kinds

    async def test_rejects_unknown_on_timeout(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        run = await self._seed_awaiting(session, organization)
        with pytest.raises(ValueError, match="on_timeout"):
            await organization_review_agent_service.park_for_merchant(
                session,
                run,
                days=7,
                on_timeout="banana",
                reviewer_user_id=uuid4(),
                reviewer_reason="x" * 5,
            )

    async def test_outbound_send_captures_thread_id(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        """Parking without a thread id sends an outbound Plain message
        and captures the returned thread id onto the run."""

        run = await self._seed_awaiting(session, organization)
        run.final_report = {
            "verdict": "deny",
            "summary": "x",
            "merchant_summary": "We need your payout details.",
            "violated_sections": [],
            "decisive_signal_kinds": [],
            "recommended_action": "await",
        }
        await session.flush()

        from unittest.mock import AsyncMock, patch

        with patch(
            "polar.integrations.plain.service.plain.create_manual_organization_thread",
            new=AsyncMock(return_value="thr_outbound_123"),
        ) as send_mock:
            await organization_review_agent_service.park_for_merchant(
                session,
                run,
                days=7,
                on_timeout="escalate",
                reviewer_user_id=uuid4(),
                reviewer_reason="asked merchant for payout details",
                # no plain_thread_id → triggers outbound send
            )

        send_mock.assert_awaited_once()
        assert run.plain_thread_id == "thr_outbound_123"

    async def test_outbound_send_graceful_when_plain_disabled(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        """When Plain is not configured the send returns "" → the run
        is parked with no thread id, no error."""

        run = await self._seed_awaiting(session, organization)
        await session.flush()

        from unittest.mock import AsyncMock, patch

        with patch(
            "polar.integrations.plain.service.plain.create_manual_organization_thread",
            new=AsyncMock(return_value=""),  # Plain disabled → ""
        ):
            await organization_review_agent_service.park_for_merchant(
                session,
                run,
                days=7,
                on_timeout="escalate",
                reviewer_user_id=uuid4(),
                reviewer_reason="asked merchant for details",
            )

        assert run.plain_thread_id is None
        assert run.due_at is not None  # park still succeeded

    async def test_rejects_out_of_range_days(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        run = await self._seed_awaiting(session, organization)
        for bad_days in (0, -3, 91, 365):
            with pytest.raises(ValueError, match="days"):
                await organization_review_agent_service.park_for_merchant(
                    session,
                    run,
                    days=bad_days,
                    on_timeout="escalate",
                    reviewer_user_id=uuid4(),
                    reviewer_reason="seven chars",
                )


@pytest.mark.asyncio
class TestSlaScannerAction:
    """Drive ``_apply_sla_timeout_action`` directly without Dramatiq."""

    async def _seed_breached(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        on_timeout: str,
        owner_user_id=None,
    ):
        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
        run.status = AgentRunStatus.AWAITING_HUMAN
        run.due_at = utc_now() - datetime.timedelta(minutes=1)
        run.on_timeout = on_timeout
        run.owner_user_id = owner_user_id
        await session.flush()
        return run

    async def test_escalate_clears_owner_and_emits_event(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
    ) -> None:
        run = await self._seed_breached(
            session,
            organization,
            on_timeout="escalate",
            owner_user_id=user.id,
        )
        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        await _apply_sla_timeout_action(session, run, repository)

        assert run.due_at is None
        assert run.on_timeout is None
        assert run.owner_user_id is None
        kinds = [e["kind"] for e in run.events]
        assert "sla_breach" in kinds
        assert "sla_breach_escalated" in kinds
        # Still AWAITING_HUMAN — escalate doesn't terminate.
        assert run.status == AgentRunStatus.AWAITING_HUMAN

    async def test_auto_close_approve_commits(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        run = await self._seed_breached(
            session, organization, on_timeout="auto_close_approve"
        )
        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        await _apply_sla_timeout_action(session, run, repository)

        assert run.status == AgentRunStatus.COMPLETED
        assert run.due_at is None
        committed_events = [
            e for e in run.events if e["kind"] == "human_committed"
        ]
        assert committed_events[-1]["committed_verdict"] == "approve"
        assert (
            "sla_breach_auto_close"
            in committed_events[-1]["reviewer_reason"]
        )

    async def test_auto_deny_commits(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        run = await self._seed_breached(
            session, organization, on_timeout="auto_deny"
        )
        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        await _apply_sla_timeout_action(session, run, repository)

        assert run.status == AgentRunStatus.COMPLETED
        committed_events = [
            e for e in run.events if e["kind"] == "human_committed"
        ]
        assert committed_events[-1]["committed_verdict"] == "deny"
