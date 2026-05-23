"""Repository for ``organization_review_signal_history``.

Two scenarios drive the read/write patterns:

* Per-run terminal: when a run completes, persist one row per emitted
  signal with ``resolution=PENDING``. Reviewers later flip rows to
  APPROVED / DISCARDED via the agent-run page.
* Per-org memory: Decide queries the per-org history to weight new
  signals (kinds previously confirmed real are stronger; kinds
  previously discarded are softer). Embedding-based semantic dedup
  layers on this same table in a future slice.
"""

from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import desc, select

from polar.kit.repository.base import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models.organization_review_signal_history import (
    OrganizationReviewSignalHistory,
    SignalResolution,
)

from .schemas import RaisedSignal
from .taxonomy import spec_for


class OrganizationReviewSignalHistoryRepository(
    RepositorySoftDeletionIDMixin[OrganizationReviewSignalHistory, UUID],
    RepositorySoftDeletionMixin[OrganizationReviewSignalHistory],
    RepositoryBase[OrganizationReviewSignalHistory],
):
    model = OrganizationReviewSignalHistory

    async def persist_signals_from_run(
        self,
        *,
        organization_id: UUID,
        agent_run_id: UUID,
        signals: Sequence[RaisedSignal],
    ) -> list[OrganizationReviewSignalHistory]:
        """Create one row per signal a terminal run emitted.

        All rows start with ``resolution=PENDING``. The driver calls
        this on graph completion (Decide returns); operators flip rows
        via :meth:`resolve` when clicking the agent-run page chips.
        """

        rows: list[OrganizationReviewSignalHistory] = []
        for signal in signals:
            severity = (
                signal.severity.value
                if signal.severity is not None
                else spec_for(signal.kind).default_severity.value
            )
            row = OrganizationReviewSignalHistory(
                organization_id=organization_id,
                agent_run_id=agent_run_id,
                kind=signal.kind.value,
                severity=severity,
                summary=signal.summary,
                evidence=signal.evidence,
                resolution=SignalResolution.PENDING,
            )
            self.session.add(row)
            rows.append(row)
        await self.session.flush()
        return rows

    async def resolve(
        self,
        row: OrganizationReviewSignalHistory,
        *,
        resolution: SignalResolution,
        reviewer_reason: str,
        reviewer_user_id: UUID,
    ) -> None:
        """Set the reviewer's verdict on a single signal row."""

        if resolution == SignalResolution.PENDING:
            raise ValueError(
                "Cannot resolve a signal back to PENDING; use retire() "
                "to mark a memory entry no-longer-representative."
            )
        if len(reviewer_reason.strip()) < 3:
            raise ValueError(
                "reviewer_reason must be ≥3 chars; the agent-run UI "
                "validates this client-side too."
            )
        row.resolution = resolution
        row.reviewer_reason = reviewer_reason.strip()
        row.reviewed_by_user_id = reviewer_user_id
        row.reviewed_at = utc_now()
        await self.session.flush()

    async def retire(
        self,
        row: OrganizationReviewSignalHistory,
        *,
        reviewer_user_id: UUID,
        reason: str,
    ) -> None:
        """Mark a memory entry as no-longer-representative.

        Excluded from memory queries but retained for audit. Use when a
        merchant has demonstrably changed behaviour (e.g. resolved a
        past dispute spike) and the historical APPROVED entry would
        otherwise unfairly bias future runs.
        """

        if row.retired_at is not None:
            return
        row.retired_at = utc_now()
        # Keep the original reviewer's reason; append the retire reason
        # to the audit trail.
        if reason.strip():
            previous = row.reviewer_reason or ""
            row.reviewer_reason = (
                previous + (" || " if previous else "") + f"retired: {reason.strip()}"
            )
        # If retired before resolution was set, record the retiring
        # reviewer.
        if row.reviewed_by_user_id is None:
            row.reviewed_by_user_id = reviewer_user_id
        await self.session.flush()

    async def list_for_run(
        self,
        agent_run_id: UUID,
        *,
        include_retired: bool = True,
    ) -> Sequence[OrganizationReviewSignalHistory]:
        """All signals emitted by a specific run.

        Used by the backoffice agent-run detail page to render
        agree/discard chips per signal. ``include_retired=True`` by
        default — the agent-run page shows the full lifecycle of every
        emission, including ones the org has since retired.
        """

        statement = (
            self.get_base_statement()
            .where(
                OrganizationReviewSignalHistory.agent_run_id == agent_run_id
            )
            .order_by(OrganizationReviewSignalHistory.created_at)
        )
        if not include_retired:
            statement = statement.where(
                OrganizationReviewSignalHistory.retired_at.is_(None)
            )
        return await self.get_all(statement)

    async def list_for_organization(
        self,
        organization_id: UUID,
        *,
        limit: int = 50,
        include_retired: bool = False,
    ) -> Sequence[OrganizationReviewSignalHistory]:
        """Newest-first listing for the backoffice agent-run drilldown."""

        statement = (
            self.get_base_statement()
            .where(
                OrganizationReviewSignalHistory.organization_id
                == organization_id
            )
            .order_by(desc(OrganizationReviewSignalHistory.created_at))
            .limit(limit)
        )
        if not include_retired:
            statement = statement.where(
                OrganizationReviewSignalHistory.retired_at.is_(None)
            )
        return await self.get_all(statement)

    async def memory_summary_for_organization(
        self,
        organization_id: UUID,
    ) -> dict[str, dict[str, int]]:
        """Per-kind APPROVED/DISCARDED counts for Decide weighting.

        Returns ``{kind: {"approved": N, "discarded": M}}`` for non-
        retired, non-pending rows. Decide layers this into the prompt
        addendum so it can over- or under-weight new emissions of
        kinds the org has history with.
        """

        statement = (
            select(
                OrganizationReviewSignalHistory.kind,
                OrganizationReviewSignalHistory.resolution,
            )
            .where(
                OrganizationReviewSignalHistory.organization_id
                == organization_id,
                OrganizationReviewSignalHistory.retired_at.is_(None),
                OrganizationReviewSignalHistory.resolution.in_(
                    (SignalResolution.APPROVED, SignalResolution.DISCARDED)
                ),
                OrganizationReviewSignalHistory.deleted_at.is_(None),
            )
        )
        rows = (await self.session.execute(statement)).all()
        summary: dict[str, dict[str, int]] = {}
        for kind, resolution in rows:
            bucket = summary.setdefault(
                kind, {"approved": 0, "discarded": 0}
            )
            if resolution == SignalResolution.APPROVED:
                bucket["approved"] += 1
            else:
                bucket["discarded"] += 1
        return summary


__all__ = ["OrganizationReviewSignalHistoryRepository"]
