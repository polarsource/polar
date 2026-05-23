"""Tests for ``OrganizationReviewAgentService`` and the shadow trigger.

These cover the Slice 1 entry surface: shadow run creation from the
legacy task path, listing, cancellation, and the executor stub.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest

from polar.models.organization import Organization
from polar.models.organization_review_agent_run import AgentRunStatus
from polar.organization_review_agent.repository import (
    OrganizationReviewAgentRunRepository,
)
from polar.organization_review_agent.schemas import AgentVerdict
from polar.organization_review_agent.service import (
    organization_review_agent_service,
)
from polar.organization_review_agent.tasks import execute_run
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture

# Unwrap the actor decorator so tests can call the underlying coroutine
# directly without depending on Dramatiq broker / Redis fixtures.
_execute_run = execute_run.__wrapped__  # type: ignore[attr-defined]


@pytest.mark.asyncio
class TestStartShadowRun:
    async def test_creates_pending_row_with_org_snapshot(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Shadow runs land as PENDING with a non-empty ``org_snapshot``
        so audits remain legible if the live org drifts later.
        """

        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ) as enqueue_mock:
            run = await organization_review_agent_service.start_shadow_run(
                session,
                organization,
                context="submission",
            )

        assert run.status == AgentRunStatus.PENDING
        assert run.triggered_by == "shadow"
        assert run.context == "submission"
        assert run.org_snapshot is not None
        assert run.org_snapshot["id"] == str(organization.id)
        assert run.org_snapshot["slug"] == organization.slug
        enqueue_mock.assert_called_once_with(
            "organization_review_agent.execute_run", run_id=run.id
        )

    async def test_passes_plain_thread_id_through(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        with patch("polar.organization_review_agent.service.enqueue_job"):
            run = await organization_review_agent_service.start_shadow_run(
                session,
                organization,
                context="appeal",
                plain_thread_id="thr_abc123",
            )

        assert run.plain_thread_id == "thr_abc123"


@pytest.mark.asyncio
class TestListing:
    async def test_list_recent_orders_newest_first(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        with patch("polar.organization_review_agent.service.enqueue_job"):
            first = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
            second = await organization_review_agent_service.start_shadow_run(
                session, organization, context="threshold"
            )

        await session.flush()
        runs = await organization_review_agent_service.list_recent(
            session, limit=10
        )

        ids = [r.id for r in runs]
        assert second.id in ids
        assert first.id in ids
        assert ids.index(second.id) < ids.index(first.id)

    async def test_list_recent_filters_by_triggered_by(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        with patch("polar.organization_review_agent.service.enqueue_job"):
            shadow = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )

        # A non-shadow row (would be a manual run in later slices).
        manual = await repository.create(
            type(shadow)(
                organization_id=organization.id,
                context="manual",
                triggered_by="operator:alice",
                status=AgentRunStatus.PENDING,
            ),
            flush=True,
        )

        shadow_only = await organization_review_agent_service.list_recent(
            session, triggered_by="shadow"
        )
        assert any(r.id == shadow.id for r in shadow_only)
        assert all(r.id != manual.id for r in shadow_only)


@pytest.mark.asyncio
class TestCancellation:
    async def test_cancel_flips_status_and_logs_event(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        with patch("polar.organization_review_agent.service.enqueue_job"):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )

        await organization_review_agent_service.cancel_run(
            session, run, reason="superseded by manual review"
        )

        assert run.status == AgentRunStatus.CANCELLED
        assert run.completed_at is not None
        kinds = [e["kind"] for e in run.events]
        assert "cancelled" in kinds

    async def test_cancel_is_noop_on_terminal_run(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """Cancellation must be idempotent — operators can click cancel
        on a row that's already terminated (e.g. after a race with the
        worker) and nothing bad happens.
        """

        with patch("polar.organization_review_agent.service.enqueue_job"):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
        run.status = AgentRunStatus.COMPLETED

        await organization_review_agent_service.cancel_run(
            session, run, reason="late cancel"
        )

        # Status stays COMPLETED; no 'cancelled' event appended.
        assert run.status == AgentRunStatus.COMPLETED
        assert all(e["kind"] != "cancelled" for e in run.events)


@pytest.mark.asyncio
class TestExecuteRunGraph:
    """``execute_run`` drives the Triage → Investigate → Decide graph.

    With no concerning signals (the default for a fresh test
    organization with no prior denials / blocks / admin block), the
    heuristic Decide returns APPROVE. Slice 2 replaces the heuristic
    with an LLM call; this test will need updating then.
    """

    async def test_pending_run_completes_with_approve_when_no_signals(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        with patch(
            "polar.organization_review_agent.tasks.settings"
        ) as settings_mock, patch(
            "polar.organization_review_agent.tasks.AsyncSessionMaker"
        ) as session_maker_mock:
            settings_mock.ENV = "test"
            settings_mock.WORKER_MAX_RETRIES = 1

            from contextlib import asynccontextmanager

            @asynccontextmanager
            async def _session_cm():
                yield session

            session_maker_mock.side_effect = lambda: _session_cm()

            with patch(
                "polar.organization_review_agent.service.enqueue_job"
            ):
                run = await organization_review_agent_service.start_shadow_run(
                    session, organization, context="submission"
                )
            await session.flush()

            await _execute_run(run.id)
            await session.refresh(run)

        assert run.status == AgentRunStatus.COMPLETED
        assert run.started_at is not None
        assert run.completed_at is not None
        assert run.final_report is not None
        assert run.final_report["verdict"] == AgentVerdict.APPROVE.value
        kinds = [e["kind"] for e in run.events]
        # Triage, Investigate, Decide each emit node_entered + node_completed.
        assert kinds.count("node_entered") == 3
        assert kinds.count("node_completed") == 3

    async def test_non_pending_run_is_skipped(
        self,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        """``execute_run`` must be idempotent on re-enqueue.

        If ``resume_stale`` flips a RUNNING row back to PENDING and the
        worker re-picks it up, but in the meantime another worker has
        completed it, the second execution must no-op.
        """

        with patch(
            "polar.organization_review_agent.service.enqueue_job"
        ):
            run = await organization_review_agent_service.start_shadow_run(
                session, organization, context="submission"
            )
        run.status = AgentRunStatus.COMPLETED
        await session.flush()

        from contextlib import asynccontextmanager

        @asynccontextmanager
        async def _session_cm():
            yield session

        with patch(
            "polar.organization_review_agent.tasks.settings"
        ) as settings_mock, patch(
            "polar.organization_review_agent.tasks.AsyncSessionMaker",
            side_effect=lambda: _session_cm(),
        ):
            settings_mock.ENV = "test"
            settings_mock.WORKER_MAX_RETRIES = 1

            # Must not raise; must not flip status off COMPLETED.
            await _execute_run(run.id)

        await session.refresh(run)
        assert run.status == AgentRunStatus.COMPLETED
