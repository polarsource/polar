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
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor

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


@actor(
    actor_name="organization_review_agent.sla_scanner",
    priority=TaskPriority.LOW,
    time_limit=60_000,
    max_retries=0,
    cron_trigger=CronTrigger.from_crontab("* * * * *"),  # every minute
)
async def sla_scanner() -> None:
    """Cron tick: fire on-timeout actions for runs past ``due_at``.

    Reads SLA-breached AWAITING_HUMAN runs and applies their
    configured action:

    * ``escalate`` (default) — release ownership + append an audit
      event so a lead reviewer picks it up via the inbox's
      "Unassigned" section.
    * ``auto_close_approve`` — commit a synthetic APPROVE with a
      ``sla_breach_auto_close`` reason. v2 stays shadow: no
      Organization.set_status call (Slice 2 exit gate flips that).
    * ``auto_deny`` — commit a synthetic DENY with the same audit
      shape. Same shadow-only semantics.

    Idempotent: clearing ``due_at`` + ``on_timeout`` after action so
    re-scanning the same row no-ops.
    """

    if settings.ENV == Environment.sandbox:
        return

    async with AsyncSessionMaker() as session:
        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        breached = await repository.list_sla_breached()

        for run in breached:
            await _apply_sla_timeout_action(session, run, repository)

        log.info(
            "organization_review_agent.sla_scanner.tick",
            breached_count=len(breached),
        )


async def _apply_sla_timeout_action(
    session,  # type: ignore[no-untyped-def]
    run,  # type: ignore[no-untyped-def]
    repository,  # type: ignore[no-untyped-def]
) -> None:
    """Apply the configured on-timeout action and clear the contract.

    Kept as a free function so unit tests can drive it directly
    without going through Dramatiq.
    """

    from polar.kit.utils import utc_now
    from polar.organization_review_agent.service import (
        organization_review_agent_service,
    )

    action = run.on_timeout
    breach_at = utc_now()
    previous_due_at = run.due_at
    # Clear contract regardless of action so re-scans don't fire twice.
    run.due_at = None
    run.on_timeout = None

    await repository.append_event(
        run,
        {
            "kind": "sla_breach",
            "at": breach_at.isoformat(),
            "previous_due_at": (
                previous_due_at.isoformat() if previous_due_at else None
            ),
            "action": action,
        },
    )

    if action == "escalate":
        # Release ownership so an unassigned-queue scanner picks it up.
        if run.owner_user_id is not None:
            previous_owner = run.owner_user_id
            run.owner_user_id = None
            await repository.append_event(
                run,
                {
                    "kind": "sla_breach_escalated",
                    "at": utc_now().isoformat(),
                    "released_owner_user_id": str(previous_owner),
                },
            )
        return

    if action == "auto_close_approve":
        await organization_review_agent_service.commit_human_decision(
            session,
            run,
            committed_verdict="approve",
            reviewer_user_id=run.owner_user_id
            or _sla_system_user_id(),
            reviewer_reason="sla_breach_auto_close: merchant did not reply",
        )
        return

    if action == "auto_deny":
        await organization_review_agent_service.commit_human_decision(
            session,
            run,
            committed_verdict="deny",
            reviewer_user_id=run.owner_user_id
            or _sla_system_user_id(),
            reviewer_reason="sla_breach_auto_deny: merchant did not reply",
        )
        return

    log.warning(
        "organization_review_agent.sla_breach.unknown_action",
        run_id=str(run.id),
        action=action,
    )


def _sla_system_user_id():  # type: ignore[no-untyped-def]
    """Placeholder system-user id for SLA-driven auto-commits.

    Slice 5 part 2 plumbs in a real system user (or a synthetic UUID
    reserved for automation) so the audit row carries an unambiguous
    "system" actor. Today, only the type is fixed (UUID); the value
    is the zero UUID.
    """

    from uuid import UUID

    return UUID("00000000-0000-0000-0000-000000000000")


__all__ = ["execute_run", "sla_scanner"]
