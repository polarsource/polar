"""Dramatiq actors for v2 agent runs.

Slice 0+1 scope:

* ``execute_run`` — picks up a PENDING shadow row, runs the graph (a
  no-op placeholder until later slices wire lanes + Decide), marks the
  row COMPLETED with an empty :class:`FinalReport`.

The actor is intentionally tiny right now: the value of shipping it
without the graph is that the shadow integration point in
``polar.organization_review.tasks`` (next commit) is testable end to
end — a legacy v1 run produces a v2 row with sensible defaults, and
the worker picks it up cleanly. Later slices add real graph execution
without changing this entry point.
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

from .repository import OrganizationReviewAgentRunRepository
from .schemas import AgentVerdict, FinalReport

log = structlog.get_logger(__name__)


class OrganizationReviewAgentTaskError(PolarTaskError): ...


class RunDoesNotExist(OrganizationReviewAgentTaskError):
    def __init__(self, run_id: uuid.UUID) -> None:
        self.run_id = run_id
        super().__init__(f"OrganizationReviewAgentRun {run_id} not found")


@actor(
    actor_name="organization_review_agent.execute_run",
    priority=TaskPriority.LOW,
    time_limit=300_000,  # 5 min
    max_retries=2,
)
async def execute_run(run_id: uuid.UUID) -> None:
    """Execute a PENDING run through the FSM.

    Slice 0+1 ships a stub that:
      1. Flips the row to RUNNING + stamps ``started_at``.
      2. Touches ``heartbeat_at`` (so the future ``resume_stale`` cron
         sees a live row).
      3. Marks the row COMPLETED with a placeholder
         :class:`FinalReport` whose verdict is NEEDS_HUMAN. The verdict
         is deliberately NEEDS_HUMAN — without a real graph we have no
         basis to claim APPROVE or DENY, and parking on human signals
         that this is shadow plumbing only.
      4. Appends two audit events: ``node_entered:execute_stub`` and
         ``node_completed:execute_stub``.

    The real graph (Triage → Investigate → Decide) replaces step 2-3
    in a subsequent slice; the row lifecycle (PENDING → RUNNING →
    COMPLETED / FAILED / CANCELLED) does not change.
    """

    if settings.ENV == Environment.sandbox:
        return

    async with AsyncSessionMaker() as session:
        repository = OrganizationReviewAgentRunRepository.from_session(session)
        run = await repository.get_by_id(run_id)
        if run is None:
            raise RunDoesNotExist(run_id)

        if run.status != AgentRunStatus.PENDING:
            # Idempotent re-enqueue protection: a stale row may be
            # picked up after ``resume_stale`` flips RUNNING → PENDING;
            # do not re-execute a row that has already terminated.
            log.info(
                "organization_review_agent.execute_run.skip_non_pending",
                run_id=str(run.id),
                status=run.status.value,
            )
            return

        run.status = AgentRunStatus.RUNNING
        run.current_node = "execute_stub"
        run.started_at = utc_now()
        await repository.touch_heartbeat(run)
        await repository.append_event(
            run,
            {
                "kind": "node_entered",
                "node": "execute_stub",
                "at": utc_now().isoformat(),
            },
        )

        # --- Stub execution ----------------------------------------
        # Real graph (Triage → Investigate → Decide) lands in a future
        # slice. The stub produces a NEEDS_HUMAN report so downstream
        # surfaces never confuse the placeholder for a real decision.
        organization_repo = OrganizationRepository.from_session(session)
        organization = await organization_repo.get_by_id(
            run.organization_id, include_blocked=True
        )

        final_report = FinalReport(
            verdict=AgentVerdict.NEEDS_HUMAN,
            summary=(
                "v2 shadow stub: graph not yet wired. "
                "Comparison against legacy v1 verdict pending."
            ),
            merchant_summary="",
            recommended_action=(
                "No action — this row is shadow plumbing. The legacy "
                "v1 analyzer's decision is authoritative until "
                "calibration parity is reached."
            ),
        )
        run.final_report = final_report.model_dump(mode="json")
        run.status = AgentRunStatus.COMPLETED
        run.completed_at = utc_now()
        run.current_node = None

        await repository.append_event(
            run,
            {
                "kind": "node_completed",
                "node": "execute_stub",
                "at": utc_now().isoformat(),
                "verdict": final_report.verdict.value,
            },
        )

        log.info(
            "organization_review_agent.execute_run.completed",
            run_id=str(run.id),
            organization_id=str(run.organization_id),
            organization_slug=(
                organization.slug if organization is not None else None
            ),
            verdict=final_report.verdict.value,
        )


__all__ = ["execute_run"]
