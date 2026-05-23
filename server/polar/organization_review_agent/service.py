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
from polar.models.organization_review_signal_history import (
    OrganizationReviewSignalHistory,
    SignalResolution,
)
from polar.postgres import AsyncReadSession, AsyncSession
from polar.worker import enqueue_job

from .repository import OrganizationReviewAgentRunRepository
from .signal_history_repository import (
    OrganizationReviewSignalHistoryRepository,
)

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

    async def assign_owner(
        self,
        session: AsyncSession,
        run: OrganizationReviewAgentRun,
        user_id: UUID,
    ) -> None:
        """Reviewer claims a run.

        Idempotent: claiming a run already owned by the same user is a
        no-op. Claiming one owned by a different user overwrites — the
        UI should warn before re-assigning, but the service does not.
        """

        if run.owner_user_id == user_id:
            return
        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        previous = run.owner_user_id
        await repository.assign_owner(run, user_id)
        await repository.append_event(
            run,
            {
                "kind": "owner_assigned",
                "at": utc_now().isoformat(),
                "owner_user_id": str(user_id),
                "previous_owner_user_id": (
                    str(previous) if previous else None
                ),
            },
        )

    async def release_owner(
        self,
        session: AsyncSession,
        run: OrganizationReviewAgentRun,
        *,
        released_by_user_id: UUID,
    ) -> None:
        """Clear the owner."""

        if run.owner_user_id is None:
            return
        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        previous = run.owner_user_id
        await repository.release_owner(run)
        await repository.append_event(
            run,
            {
                "kind": "owner_released",
                "at": utc_now().isoformat(),
                "previous_owner_user_id": str(previous),
                "released_by_user_id": str(released_by_user_id),
            },
        )

    async def list_inbox_for_user(
        self,
        session: AsyncReadSession,
        user_id: UUID,
        *,
        limit: int = 100,
    ) -> dict[str, Sequence[OrganizationReviewAgentRun]]:
        """Operator inbox bundle: action_required + unassigned.

        Returns a dict the backoffice template can iterate over:
        - ``action_required`` — my AWAITING_HUMAN runs.
        - ``unassigned`` — AWAITING_HUMAN runs nobody owns yet.

        Slice 3 part 2 adds ``waiting`` (parked runs the user owns)
        and ``sla_breaches`` (any owner, past due_at).
        """

        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        action_required = await repository.list_for_owner(
            user_id,
            statuses=[AgentRunStatus.AWAITING_HUMAN],
            limit=limit,
        )
        unassigned = await repository.list_unowned_awaiting_human(
            limit=limit
        )
        return {
            "action_required": action_required,
            "unassigned": unassigned,
        }

    async def open_pattern_match(
        self,
        session: AsyncSession,
        *,
        signature_kind: str,
        triggering_org_ids: Sequence[UUID],
        notes: str,
    ) -> OrganizationReviewAgentRun:
        """Open a PATTERN_MATCH parent run linking N child orgs.

        Called by the pattern_detector cron when ≥N distinct orgs
        share the same signature in a window. The parent's
        ``triggered_by`` is ``"pattern_detector"``; the per-org child
        runs (created via :meth:`start_shadow_run` with
        ``context="pattern_match"``) carry ``parent_agent_run_id``
        pointing back here.

        Hard-capped at 200 children — the detector's repository helper
        enforces this; this method assumes the caller already pruned.
        """

        if len(triggering_org_ids) > 200:
            raise ValueError(
                "Pattern match fan-out hard-capped at 200 orgs; "
                f"caller passed {len(triggering_org_ids)}."
            )
        if len(triggering_org_ids) < 1:
            raise ValueError(
                "open_pattern_match requires at least one triggering "
                "org id."
            )
        if len(notes.strip()) < 10:
            raise ValueError(
                "Pattern match notes must be ≥10 chars (audit signal)."
            )

        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        # The parent run is org-anchored to the first triggering org —
        # arbitrary but useful for the backoffice listing. Child links
        # carry the full graph via parent_agent_run_id.
        parent = OrganizationReviewAgentRun(
            organization_id=triggering_org_ids[0],
            context="pattern_match",
            triggered_by="pattern_detector",
            status=AgentRunStatus.AWAITING_HUMAN,
            org_snapshot={
                "pattern_kind": signature_kind,
                "triggering_org_count": len(triggering_org_ids),
                "triggering_org_ids": [
                    str(oid) for oid in triggering_org_ids
                ],
                "notes": notes.strip(),
            },
            final_report=None,
        )
        await repository.create(parent, flush=True)
        await repository.append_event(
            parent,
            {
                "kind": "pattern_opened",
                "at": utc_now().isoformat(),
                "signature_kind": signature_kind,
                "triggering_org_count": len(triggering_org_ids),
                "notes": notes.strip(),
            },
        )
        log.info(
            "organization_review_agent.pattern.opened",
            parent_run_id=str(parent.id),
            signature_kind=signature_kind,
            triggering_org_count=len(triggering_org_ids),
        )
        return parent

    async def park_for_merchant(
        self,
        session: AsyncSession,
        run: OrganizationReviewAgentRun,
        *,
        days: int,
        on_timeout: str,
        reviewer_user_id: UUID,
        reviewer_reason: str,
        plain_thread_id: str | None = None,
    ) -> None:
        """Reviewer parks a run waiting for a merchant reply.

        Sets ``due_at`` to ``now + days`` and ``on_timeout`` to one of
        ``auto_deny`` / ``auto_close_approve`` / ``escalate``.
        Optionally stores the ``plain_thread_id`` if the outbound
        merchant message landed in a fresh Plain thread.

        The actual outbound message send is Slice 5 part 2 — this
        method records the SLA contract; the message send happens in
        the caller (a backoffice button that hits Plain via
        :mod:`polar.integrations.plain`).
        """

        if on_timeout not in ("auto_deny", "auto_close_approve", "escalate"):
            raise ValueError(
                f"Unknown on_timeout {on_timeout!r}; expected one of "
                "auto_deny / auto_close_approve / escalate."
            )
        if days <= 0 or days > 90:
            raise ValueError(
                "days must be in (0, 90]; longer windows aren't "
                "operationally supported."
            )
        if len(reviewer_reason.strip()) < 3:
            raise ValueError(
                "reviewer_reason must be ≥3 chars for the audit event."
            )

        import datetime

        due_at = utc_now() + datetime.timedelta(days=days)
        run.due_at = due_at
        run.on_timeout = on_timeout
        if plain_thread_id is not None:
            run.plain_thread_id = plain_thread_id
        # Run stays AWAITING_HUMAN; reviewer's parking action sets the
        # contract but doesn't change status (the run was already
        # AWAITING_HUMAN before).
        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        await repository.append_event(
            run,
            {
                "kind": "await_merchant_armed",
                "at": utc_now().isoformat(),
                "due_at": due_at.isoformat(),
                "on_timeout": on_timeout,
                "days": days,
                "reviewer_user_id": str(reviewer_user_id),
                "reviewer_reason": reviewer_reason.strip(),
                "plain_thread_id": plain_thread_id,
            },
        )
        log.info(
            "organization_review_agent.await_merchant.armed",
            run_id=str(run.id),
            due_at=due_at.isoformat(),
            on_timeout=on_timeout,
        )

    async def list_sla_breaches(
        self,
        session: AsyncReadSession,
        *,
        limit: int = 50,
    ) -> Sequence[OrganizationReviewAgentRun]:
        """Runs whose ``due_at`` has passed without a resolution.

        Picked up by the cron scanner each minute; the scanner fires
        the row's ``on_timeout`` action and clears ``due_at``.
        """

        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        return await repository.list_sla_breached(limit=limit)

    async def commit_human_decision(
        self,
        session: AsyncSession,
        run: OrganizationReviewAgentRun,
        *,
        committed_verdict: str,
        reviewer_user_id: UUID,
        reviewer_reason: str,
    ) -> None:
        """Reviewer committed an AWAITING_HUMAN run to a terminal verdict.

        Flips status to COMPLETED + appends a structured
        ``human_committed`` event with the reviewer's id + reason. The
        v2 run's verdict is recorded; *no org-status mutation happens
        here* — v2 stays a strict shadow of the legacy decision flow
        until promotion. Slice 2's exit gate is when this method also
        calls ``Organization.set_status``.

        ``committed_verdict`` is free-form here (typically the verdict
        the reviewer agreed with — same as the FinalReport's verdict;
        sometimes overridden during deny-confirm) so the audit row
        carries the actual human decision, not just the v2 verdict.
        """

        if run.status != AgentRunStatus.AWAITING_HUMAN:
            log.info(
                "organization_review_agent.commit.non_awaiting_noop",
                run_id=str(run.id),
                status=run.status.value,
            )
            return
        if len(reviewer_reason.strip()) < 3:
            raise ValueError(
                "reviewer_reason must be ≥3 chars for human-commit audit."
            )

        repository = OrganizationReviewAgentRunRepository.from_session(
            session
        )
        run.status = AgentRunStatus.COMPLETED
        run.completed_at = utc_now()
        run.current_node = None
        await repository.append_event(
            run,
            {
                "kind": "human_committed",
                "at": utc_now().isoformat(),
                "committed_verdict": committed_verdict,
                "reviewer_user_id": str(reviewer_user_id),
                "reviewer_reason": reviewer_reason.strip(),
            },
        )
        log.info(
            "organization_review_agent.committed",
            run_id=str(run.id),
            committed_verdict=committed_verdict,
            reviewer_user_id=str(reviewer_user_id),
        )

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

    async def resolve_signal(
        self,
        session: AsyncSession,
        signal: OrganizationReviewSignalHistory,
        *,
        resolution: SignalResolution,
        reviewer_reason: str,
        reviewer_user_id: UUID,
    ) -> None:
        """Reviewer clicked agree/discard on a signal chip.

        Writes the verdict + reason to the signal history row. Memory
        weighting picks this up automatically on the next run for the
        same organization.
        """

        history_repo = (
            OrganizationReviewSignalHistoryRepository.from_session(session)
        )
        await history_repo.resolve(
            signal,
            resolution=resolution,
            reviewer_reason=reviewer_reason,
            reviewer_user_id=reviewer_user_id,
        )

        log.info(
            "organization_review_agent.signal.resolved",
            signal_id=str(signal.id),
            run_id=str(signal.agent_run_id),
            organization_id=str(signal.organization_id),
            kind=signal.kind,
            resolution=resolution.value,
        )

    async def retire_signal(
        self,
        session: AsyncSession,
        signal: OrganizationReviewSignalHistory,
        *,
        reviewer_user_id: UUID,
        reason: str,
    ) -> None:
        """Mark a signal history row no-longer-representative.

        Used when a merchant has demonstrably changed behaviour and a
        past adjudication would unfairly bias future runs. Excluded
        from memory queries but retained for audit.
        """

        history_repo = (
            OrganizationReviewSignalHistoryRepository.from_session(session)
        )
        await history_repo.retire(
            signal, reviewer_user_id=reviewer_user_id, reason=reason
        )
        log.info(
            "organization_review_agent.signal.retired",
            signal_id=str(signal.id),
            kind=signal.kind,
        )

    async def get_signal_memory_for_organization(
        self,
        session: AsyncReadSession,
        organization_id: UUID,
    ) -> dict[str, dict[str, int]]:
        """Per-kind APPROVED/DISCARDED counts used by Decide weighting."""

        history_repo = (
            OrganizationReviewSignalHistoryRepository.from_session(session)
        )
        return await history_repo.memory_summary_for_organization(
            organization_id
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
