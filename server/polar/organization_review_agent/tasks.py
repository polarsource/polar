"""Dramatiq actors for v2 agent runs.

* ``execute_run`` — picks up a PENDING shadow row, drives the
  Triage → Investigate → Decide graph, persists state_snapshot after
  each node, and flips the row to COMPLETED / FAILED / AWAITING_HUMAN
  based on the terminal state's tentative report.

The graph's internal node lifecycle (and the per-node
heartbeat/event/snapshot bookkeeping) lives in ``graph.py``.
"""

from __future__ import annotations

import uuid

import structlog

from polar.config import Environment, settings
from polar.exceptions import PolarTaskError
from polar.kit.utils import utc_now
from polar.models.organization_review_agent_run import AgentRunStatus
from polar.organization.repository import OrganizationRepository
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .graph import execute_graph
from .repository import OrganizationReviewAgentRunRepository

log = structlog.get_logger(__name__)


class OrganizationReviewAgentTaskError(PolarTaskError): ...


class RunDoesNotExist(OrganizationReviewAgentTaskError):
    def __init__(self, run_id: uuid.UUID) -> None:
        self.run_id = run_id
        super().__init__(f"OrganizationReviewAgentRun {run_id} not found")


class OrganizationDoesNotExist(OrganizationReviewAgentTaskError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        super().__init__(
            f"Organization {organization_id} not found for agent run"
        )


@actor(
    actor_name="organization_review_agent.execute_run",
    priority=TaskPriority.LOW,
    time_limit=300_000,  # 5 min
    max_retries=2,
)
async def execute_run(run_id: uuid.UUID) -> None:
    """Execute a PENDING run through the FSM.

    Lifecycle:
      1. Load the run; bail early on non-PENDING status (idempotent re-
         enqueue protection — if ``resume_stale`` flips a stuck RUNNING
         row back to PENDING and a second worker picks it up after the
         first one already terminated it, the second exec is a no-op).
      2. Flip to RUNNING + stamp ``started_at``.
      3. Hand off to :func:`execute_graph` which drives each node,
         persists ``state_snapshot`` between transitions, and finalises
         the row to COMPLETED / FAILED / AWAITING_HUMAN.

    Cancellation: ``execute_graph`` re-reads the row between nodes and
    bails if status flipped to CANCELLED. The cancel is cooperative —
    an in-flight node finishes before the loop exits.
    """

    if settings.ENV == Environment.sandbox:
        return

    async with AsyncSessionMaker() as session:
        repository = OrganizationReviewAgentRunRepository.from_session(session)
        run = await repository.get_by_id(run_id)
        if run is None:
            raise RunDoesNotExist(run_id)

        if run.status != AgentRunStatus.PENDING:
            log.info(
                "organization_review_agent.execute_run.skip_non_pending",
                run_id=str(run.id),
                status=run.status.value,
            )
            return

        organization_repo = OrganizationRepository.from_session(session)
        organization = await organization_repo.get_by_id(
            run.organization_id, include_blocked=True
        )
        if organization is None:
            raise OrganizationDoesNotExist(run.organization_id)

        run.status = AgentRunStatus.RUNNING
        run.started_at = utc_now()
        await repository.touch_heartbeat(run)

        await execute_graph(session, run, organization)

        log.info(
            "organization_review_agent.execute_run.finished",
            run_id=str(run.id),
            organization_id=str(run.organization_id),
            slug=organization.slug,
            status=run.status.value,
            verdict=(
                run.final_report.get("verdict")
                if run.final_report
                else None
            ),
        )


__all__ = ["execute_run"]
