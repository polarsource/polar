"""Database queries for ``organization_review_agent_runs``.

Thin RepositoryBase subclass — most queries are list/get by org or by
status. Append-only event/llm_call mutations use SQL ``||`` to avoid
lost-update under concurrent reviewers; full state updates flush the
``state_snapshot`` JSONB column as a single write.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import desc, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import cast

from polar.kit.repository.base import RepositoryBase, RepositorySoftDeletionIDMixin
from polar.kit.utils import utc_now
from polar.models.organization_review_agent_run import (
    AgentRunStatus,
    OrganizationReviewAgentRun,
)


class OrganizationReviewAgentRunRepository(
    RepositorySoftDeletionIDMixin[OrganizationReviewAgentRun, UUID],
    RepositoryBase[OrganizationReviewAgentRun],
):
    model = OrganizationReviewAgentRun

    async def list_recent(
        self,
        *,
        limit: int = 50,
        statuses: Sequence[AgentRunStatus] | None = None,
        triggered_by: str | None = None,
    ) -> Sequence[OrganizationReviewAgentRun]:
        """Backoffice agent-runs list.

        ``statuses`` filters to a subset (e.g. ``AWAITING_HUMAN`` to find
        runs the operator needs to action). ``triggered_by`` lets the
        Slice 1 dashboard isolate shadow runs from operator-driven ones.
        """

        statement = (
            self.get_base_statement()
            .order_by(desc(OrganizationReviewAgentRun.created_at))
            .limit(limit)
        )
        if statuses is not None:
            statement = statement.where(
                OrganizationReviewAgentRun.status.in_(statuses)
            )
        if triggered_by is not None:
            statement = statement.where(
                OrganizationReviewAgentRun.triggered_by == triggered_by
            )
        return await self.get_all(statement)

    async def list_for_organization(
        self,
        organization_id: UUID,
        *,
        limit: int = 20,
    ) -> Sequence[OrganizationReviewAgentRun]:
        """All v2 runs for a single org, newest first.

        Used by the backoffice org-detail page to show the v2 history
        alongside the legacy ``organization_agent_reviews``.
        """

        statement = (
            self.get_base_statement()
            .where(
                OrganizationReviewAgentRun.organization_id == organization_id
            )
            .order_by(desc(OrganizationReviewAgentRun.created_at))
            .limit(limit)
        )
        return await self.get_all(statement)

    async def get_latest_for_organization(
        self, organization_id: UUID
    ) -> OrganizationReviewAgentRun | None:
        statement = (
            self.get_base_statement()
            .where(
                OrganizationReviewAgentRun.organization_id == organization_id
            )
            .order_by(desc(OrganizationReviewAgentRun.created_at))
            .limit(1)
        )
        return await self.get_one_or_none(statement)

    async def list_for_owner(
        self,
        user_id: UUID,
        *,
        statuses: Sequence[AgentRunStatus] | None = None,
        limit: int = 100,
    ) -> Sequence[OrganizationReviewAgentRun]:
        """Runs owned by a specific reviewer.

        Powers the operator inbox's "Action required" section
        (statuses=AWAITING_HUMAN) and "Waiting" section (status=…
        with parking node names, in later slices).
        """

        statement = (
            self.get_base_statement()
            .where(OrganizationReviewAgentRun.owner_user_id == user_id)
            .order_by(desc(OrganizationReviewAgentRun.created_at))
            .limit(limit)
        )
        if statuses is not None:
            statement = statement.where(
                OrganizationReviewAgentRun.status.in_(statuses)
            )
        return await self.get_all(statement)

    async def list_unowned_awaiting_human(
        self,
        *,
        limit: int = 100,
    ) -> Sequence[OrganizationReviewAgentRun]:
        """AWAITING_HUMAN runs that no reviewer has claimed yet.

        The inbox "Unassigned" section pulls from here so reviewers
        can pick up runs without waiting for auto-routing to land
        (Slice 3 part 2).
        """

        statement = (
            self.get_base_statement()
            .where(
                OrganizationReviewAgentRun.status
                == AgentRunStatus.AWAITING_HUMAN,
                OrganizationReviewAgentRun.owner_user_id.is_(None),
            )
            .order_by(OrganizationReviewAgentRun.created_at)  # oldest first
            .limit(limit)
        )
        return await self.get_all(statement)

    async def assign_owner(
        self, run: OrganizationReviewAgentRun, user_id: UUID
    ) -> None:
        """Claim a run for the given reviewer."""

        run.owner_user_id = user_id
        await self.session.flush()

    async def release_owner(
        self, run: OrganizationReviewAgentRun
    ) -> None:
        """Clear the owner (e.g. reviewer reassigned themselves OOO)."""

        run.owner_user_id = None
        await self.session.flush()

    async def list_sla_breached(
        self,
        *,
        limit: int = 50,
    ) -> Sequence[OrganizationReviewAgentRun]:
        """AWAITING_HUMAN runs whose ``due_at`` has passed.

        The cron scanner reads this list each minute, fires the row's
        configured ``on_timeout`` action, and clears ``due_at`` /
        ``on_timeout``. Bounded by ``limit`` so a backlog can't blow
        the cron's time budget — the next tick picks up the rest.
        """

        statement = (
            self.get_base_statement()
            .where(
                OrganizationReviewAgentRun.status
                == AgentRunStatus.AWAITING_HUMAN,
                OrganizationReviewAgentRun.due_at.is_not(None),
                OrganizationReviewAgentRun.due_at < utc_now(),
            )
            .order_by(OrganizationReviewAgentRun.due_at)
            .limit(limit)
        )
        return await self.get_all(statement)

    async def list_stale_running(
        self, *, heartbeat_older_than: datetime
    ) -> Sequence[OrganizationReviewAgentRun]:
        """RUNNING rows whose worker died mid-execution.

        Used by the ``resume_stale`` cron (future slice) to flip them
        back to PENDING for re-enqueue. ``heartbeat_older_than`` is the
        cron's freshness budget (typically 60s).
        """

        statement = self.get_base_statement().where(
            OrganizationReviewAgentRun.status == AgentRunStatus.RUNNING,
            OrganizationReviewAgentRun.heartbeat_at < heartbeat_older_than,
        )
        return await self.get_all(statement)

    async def append_event(
        self,
        run: OrganizationReviewAgentRun,
        event: dict[str, Any],
    ) -> None:
        """Append a single event to ``events`` via SQL ``||``.

        Avoids the read-modify-write race a Python-side mutation would
        introduce when two reviewers act on the same run simultaneously
        (e.g. one approves a signal while another posts a comment).
        """

        await self.session.execute(
            self.model.__table__.update()
            .where(self.model.id == run.id)
            .values(
                events=self.model.events.op("||")(
                    cast([event], JSONB)
                )
            )
        )
        # Re-sync the in-memory object's events list so subsequent reads
        # in this session see the same view.
        run.events = [*run.events, event]

    async def touch_heartbeat(
        self, run: OrganizationReviewAgentRun
    ) -> None:
        """Bump ``heartbeat_at`` to the current time.

        Called by the executing node so the ``resume_stale`` cron can
        distinguish "actively progressing" from "worker crashed".
        """

        run.heartbeat_at = utc_now()
        await self.session.flush()


__all__ = ["OrganizationReviewAgentRunRepository"]
