"""Service layer for v2 agent runs.

Slice 0+1 scope:

* :meth:`OrganizationReviewAgentService.start_shadow_run` — called
  immediately after the legacy v1 analyzer finishes. Creates a v2 row
  with ``triggered_by="shadow"`` and a complete ``org_snapshot``. The
  graph (lanes + Triage/Investigate/Decide nodes) lands in a follow-up
  slice; until then, the shadow row is created with status PENDING and
  is picked up by ``polar.organization_review_agent.tasks.execute_run``
  for a graph-stub run that marks it COMPLETED with an empty report.
* :meth:`OrganizationReviewAgentService.list_recent` — backoffice
  listing dependency for the upcoming Slice 1 disagreement strip.
* :meth:`OrganizationReviewAgentService.cancel_run` — operator-driven
  cancel with audit trail event.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any
from uuid import UUID

import structlog

from polar.kit.utils import utc_now
from polar.models.organization import Organization
from polar.models.organization_review_agent_run import (
    AgentRunStatus,
    OrganizationReviewAgentRun,
)
from polar.postgres import AsyncReadSession, AsyncSession

from .repository import OrganizationReviewAgentRunRepository

log = structlog.get_logger(__name__)


class OrganizationReviewAgentService:
    """Public surface for v2 agent runs.

    Method-by-method singleton — instantiate once at module bottom.
    No dependency injection beyond sessions to stay consistent with
    other Polar services.
    """

    async def start_shadow_run(
        self,
        session: AsyncSession,
        organization: Organization,
        *,
        context: str,
        plain_thread_id: str | None = None,
    ) -> OrganizationReviewAgentRun:
        """Create a shadow run row alongside a legacy v1 analyzer pass.

        Called from ``polar.organization_review.tasks._persist_agent_result``
        after the v1 row lands. The shadow run is enqueued for execution
        via Dramatiq, not run inline, so a slow v2 run cannot extend the
        latency of the legacy auto-decision path.

        Returns the freshly-created row so the caller can log its id.
        """

        repository = OrganizationReviewAgentRunRepository.from_session(session)
        run = OrganizationReviewAgentRun(
            organization_id=organization.id,
            context=context,
            triggered_by="shadow",
            status=AgentRunStatus.PENDING,
            org_snapshot=self._snapshot_organization(organization),
            plain_thread_id=plain_thread_id,
        )
        await repository.create(run, flush=True)

        log.info(
            "organization_review_agent.shadow_run.created",
            run_id=str(run.id),
            organization_id=str(organization.id),
            slug=organization.slug,
            context=context,
        )

        # Enqueue execution late — *after* the row is flushed so the
        # actor can look it up. The actor itself opens a fresh session.
        from polar.worker import enqueue_job

        enqueue_job(
            "organization_review_agent.execute_run",
            run_id=run.id,
        )
        return run

    async def list_recent(
        self,
        session: AsyncReadSession,
        *,
        limit: int = 50,
        statuses: Sequence[AgentRunStatus] | None = None,
        triggered_by: str | None = None,
    ) -> Sequence[OrganizationReviewAgentRun]:
        """Backoffice agent-runs list."""

        repository = OrganizationReviewAgentRunRepository.from_session(session)
        return await repository.list_recent(
            limit=limit, statuses=statuses, triggered_by=triggered_by
        )

    async def list_for_organization(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
        *,
        limit: int = 20,
    ) -> Sequence[OrganizationReviewAgentRun]:
        """All v2 runs for one organization (newest first)."""

        repository = OrganizationReviewAgentRunRepository.from_session(session)
        return await repository.list_for_organization(
            organization_id, limit=limit
        )

    async def get_run(
        self, session: AsyncReadSession, run_id: UUID
    ) -> OrganizationReviewAgentRun | None:
        repository = OrganizationReviewAgentRunRepository.from_session(session)
        return await repository.get_by_id(run_id)

    async def cancel_run(
        self,
        session: AsyncSession,
        run: OrganizationReviewAgentRun,
        *,
        reason: str,
        user_id: UUID | None = None,
    ) -> None:
        """Flag a run as CANCELLED with an audit-log event.

        The executing node checks ``status`` on every ``_enter_node``
        and exits early if cancelled. This is cooperative — the cancel
        does not preempt an in-flight LLM call.
        """

        if run.status in (
            AgentRunStatus.COMPLETED,
            AgentRunStatus.FAILED,
            AgentRunStatus.CANCELLED,
        ):
            log.info(
                "organization_review_agent.cancel.terminal_state_noop",
                run_id=str(run.id),
                status=run.status.value,
            )
            return

        repository = OrganizationReviewAgentRunRepository.from_session(session)
        run.status = AgentRunStatus.CANCELLED
        run.completed_at = utc_now()
        await repository.append_event(
            run,
            {
                "kind": "cancelled",
                "at": utc_now().isoformat(),
                "reason": reason,
                "user_id": str(user_id) if user_id else None,
            },
        )
        log.info(
            "organization_review_agent.cancelled",
            run_id=str(run.id),
            reason=reason,
        )

    @staticmethod
    def _snapshot_organization(organization: Organization) -> dict[str, Any]:
        """Capture org fields at run start for later audit.

        Mirrors what the legacy task stores on
        ``OrganizationReview.organization_details_snapshot`` so v1 and
        v2 audits stay legible side-by-side.
        """

        return {
            "id": str(organization.id),
            "name": organization.name,
            "slug": organization.slug,
            "website": organization.website,
            "status": organization.status.value
            if organization.status is not None
            else None,
            "details": organization.details,
            "socials": organization.socials,
        }


organization_review_agent_service = OrganizationReviewAgentService()


__all__ = [
    "OrganizationReviewAgentService",
    "organization_review_agent_service",
]
