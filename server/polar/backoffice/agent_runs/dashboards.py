"""Lead dashboards for v2 agent run health (Slice 12).

Single-page dashboard: counts by status / context / triggered_by +
auto-take eligibility rate + recent SLA breaches. All queries hit
the read replica.
"""

from __future__ import annotations

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from tagflow import tag, text

from polar.kit.utils import utc_now
from polar.models.organization_review_agent_run import (
    AgentRunStatus,
    OrganizationReviewAgentRun,
)
from polar.postgres import AsyncReadSession, get_db_read_session

from ..dependencies import UserSession, get_admin
from ..layout import layout

router = APIRouter()


@router.get("/dashboard", name="agent_runs:dashboard")
async def dashboard(
    request: Request,
    session: AsyncReadSession = Depends(get_db_read_session),
    user_session: UserSession = Depends(get_admin),
) -> None:
    """Lead-facing dashboard of v2 agent health.

    Counts queried over the past 7 days. Slice 12 part 2 adds the
    full set of KPIs the plan called out (per-rule auto-close rate,
    calibration drift, agreement-rate distribution, etc).
    """

    cutoff = utc_now() - timedelta(days=7)

    counts_by_status = await _counts_by_column(
        session,
        OrganizationReviewAgentRun.status,
        cutoff,
    )
    counts_by_context = await _counts_by_column(
        session,
        OrganizationReviewAgentRun.context,
        cutoff,
    )
    counts_by_trigger = await _counts_by_column(
        session,
        OrganizationReviewAgentRun.triggered_by,
        cutoff,
    )
    total_completed = await _total_completed(session, cutoff)
    sla_breaches_count = await _sla_breach_count(session, cutoff)

    with layout(
        request,
        [("Agent Dashboard", str(request.url))],
        "agent_runs:dashboard",
    ):
        with tag.div(classes="flex flex-col gap-6"):
            with tag.h1(classes="text-4xl"):
                text("Agent Dashboard — last 7 days")

            # Top-line metric tiles
            with tag.div(classes="grid grid-cols-2 md:grid-cols-4 gap-4"):
                _metric_tile("Total completed", str(total_completed))
                _metric_tile(
                    "AWAITING_HUMAN",
                    str(counts_by_status.get("awaiting_human", 0)),
                )
                _metric_tile(
                    "FAILED",
                    str(counts_by_status.get("failed", 0)),
                )
                _metric_tile(
                    "SLA breaches",
                    str(sla_breaches_count),
                )

            with tag.div(classes="grid grid-cols-1 md:grid-cols-3 gap-4"):
                _counts_card("By status", counts_by_status)
                _counts_card("By context", counts_by_context)
                _counts_card("By trigger", counts_by_trigger)


def _metric_tile(label: str, value: str) -> None:
    with tag.div(classes="stat bg-base-100 shadow rounded"):
        with tag.div(classes="stat-title text-base-content/70"):
            text(label)
        with tag.div(classes="stat-value text-3xl"):
            text(value)


def _counts_card(title: str, counts: dict[str, int]) -> None:
    with tag.div(classes="card bg-base-100 shadow"):
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title text-lg"):
                text(title)
            if not counts:
                with tag.div(classes="text-base-content/60 text-sm"):
                    text("No runs in window.")
                return
            with tag.table(classes="table table-xs"):
                with tag.tbody():
                    for k, v in sorted(
                        counts.items(), key=lambda kv: -kv[1]
                    ):
                        with tag.tr():
                            with tag.td(classes="font-mono text-xs"):
                                text(str(k))
                            with tag.td(classes="text-right font-semibold"):
                                text(str(v))


async def _counts_by_column(
    session: AsyncReadSession, column, cutoff: datetime
) -> dict[str, int]:
    statement = (
        select(column, func.count())
        .where(
            OrganizationReviewAgentRun.created_at >= cutoff,
            OrganizationReviewAgentRun.deleted_at.is_(None),
        )
        .group_by(column)
    )
    rows = (await session.execute(statement)).all()
    return {
        (
            value.value if hasattr(value, "value") else str(value)
        ): count
        for value, count in rows
    }


async def _total_completed(
    session: AsyncReadSession, cutoff: datetime
) -> int:
    statement = select(func.count(OrganizationReviewAgentRun.id)).where(
        OrganizationReviewAgentRun.completed_at.is_not(None),
        OrganizationReviewAgentRun.completed_at >= cutoff,
        OrganizationReviewAgentRun.deleted_at.is_(None),
    )
    return (await session.execute(statement)).scalar_one()


async def _sla_breach_count(
    session: AsyncReadSession, cutoff: datetime
) -> int:
    """Count of runs whose events log contains an `sla_breach` entry
    in the window. Plain JSONB containment query so the index is
    optional — the dashboard's 7d window keeps the row count bounded.
    """

    statement = select(func.count(OrganizationReviewAgentRun.id)).where(
        OrganizationReviewAgentRun.modified_at >= cutoff,
        OrganizationReviewAgentRun.deleted_at.is_(None),
        OrganizationReviewAgentRun.events.contains([{"kind": "sla_breach"}]),
    )
    return (await session.execute(statement)).scalar_one()


__all__ = ["router"]
