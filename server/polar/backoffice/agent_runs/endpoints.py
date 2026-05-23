"""Backoffice surface for v2 organization review agent runs.

Slice 1 ships read-only screens: a recent-runs index and a detail page
with the run's events, final report, and per-call LLM cost breakdown.
Interactive surfaces (signal review chips, deny-confirm, await-
merchant trigger, cancel) layer on in subsequent slices and reuse the
same templates.
"""

from __future__ import annotations

import json
from collections.abc import Sequence
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import UUID4
from tagflow import tag, text

from polar.models.organization_review_agent_run import (
    AgentRunStatus,
    OrganizationReviewAgentRun,
)
from polar.organization_review_agent.service import (
    organization_review_agent_service,
)
from polar.postgres import AsyncReadSession, get_db_read_session

from ..layout import layout

router = APIRouter()


# ---------------------------------------------------------------------------
# Status / trigger badges
# ---------------------------------------------------------------------------


def _status_badge(status: AgentRunStatus) -> None:
    variant = {
        AgentRunStatus.PENDING: "badge-ghost",
        AgentRunStatus.RUNNING: "badge-info",
        AgentRunStatus.AWAITING_HUMAN: "badge-warning",
        AgentRunStatus.COMPLETED: "badge-success",
        AgentRunStatus.FAILED: "badge-error",
        AgentRunStatus.CANCELLED: "badge-neutral",
    }.get(status, "badge-ghost")
    with tag.div(classes=f"badge {variant}"):
        text(status.value)


def _triggered_by_badge(triggered_by: str) -> None:
    # "shadow" is the highest-volume bucket in Slice 1; visually distinct.
    if triggered_by == "shadow":
        classes_ = "badge badge-outline badge-secondary"
    elif triggered_by.startswith("operator:"):
        classes_ = "badge badge-outline badge-primary"
    else:
        classes_ = "badge badge-outline"
    with tag.div(classes=classes_):
        text(triggered_by)


def _context_badge(context: str) -> None:
    with tag.div(classes="badge badge-outline"):
        text(context)


def _verdict_badge(verdict: str | None) -> None:
    if verdict is None:
        with tag.div(classes="badge badge-ghost"):
            text("—")
        return
    variant = {
        "approve": "badge-success",
        "deny": "badge-error",
        "needs_human": "badge-warning",
    }.get(verdict, "badge-ghost")
    with tag.div(classes=f"badge {variant}"):
        text(verdict)


# ---------------------------------------------------------------------------
# List page
# ---------------------------------------------------------------------------


@router.get("/", name="agent_runs:list")
async def list_recent(
    request: Request,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> None:
    runs = await organization_review_agent_service.list_recent(
        session, limit=100
    )

    with layout(
        request,
        [("Agent Runs", str(request.url_for("agent_runs:list")))],
        "agent_runs:list",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            with tag.div(classes="flex items-center justify-between"):
                with tag.h1(classes="text-4xl"):
                    text("Agent Runs")
                with tag.div(classes="flex gap-2 text-sm text-base-content/70"):
                    text(f"{len(runs)} runs (newest first)")

            with tag.p(classes="text-sm text-base-content/70 max-w-3xl"):
                text(
                    "v2 organization review agent. Shadows the legacy "
                    "analyzer in polar.organization_review while "
                    "calibration closes; promotion to authoritative is "
                    "gated on the comparison dashboards."
                )

            if not runs:
                with tag.div(
                    classes="text-center py-12 text-base-content/60"
                ):
                    text("No agent runs yet.")
            else:
                _render_list_table(request, runs)


def _render_list_table(
    request: Request, runs: Sequence[OrganizationReviewAgentRun]
) -> None:
    with tag.div(classes="overflow-x-auto"):
        with tag.table(classes="table table-zebra table-sm"):
            with tag.thead():
                with tag.tr():
                    for header in (
                        "Created",
                        "Org",
                        "Context",
                        "Trigger",
                        "Status",
                        "Verdict",
                        "Node",
                    ):
                        with tag.th():
                            text(header)
            with tag.tbody():
                for run in runs:
                    _render_list_row(request, run)


def _render_list_row(
    request: Request, run: OrganizationReviewAgentRun
) -> None:
    detail_url = str(request.url_for("agent_runs:get", id=run.id))
    with tag.tr(
        classes="hover cursor-pointer",
        onclick=f"window.location='{detail_url}'",
    ):
        with tag.td(classes="whitespace-nowrap font-mono text-xs"):
            text(run.created_at.strftime("%Y-%m-%d %H:%M:%S"))
        with tag.td():
            org_slug = (
                run.org_snapshot.get("slug", "—")
                if run.org_snapshot
                else "—"
            )
            with tag.a(href=detail_url, classes="link"):
                text(org_slug)
        with tag.td():
            _context_badge(run.context)
        with tag.td():
            _triggered_by_badge(run.triggered_by)
        with tag.td():
            _status_badge(run.status)
        with tag.td():
            verdict = (
                run.final_report.get("verdict") if run.final_report else None
            )
            _verdict_badge(verdict)
        with tag.td(classes="font-mono text-xs"):
            text(run.current_node or "—")


# ---------------------------------------------------------------------------
# Detail page
# ---------------------------------------------------------------------------


async def _get_or_404(
    session: AsyncReadSession, run_id: UUID4
) -> OrganizationReviewAgentRun:
    run = await organization_review_agent_service.get_run(session, run_id)
    if run is None:
        raise HTTPException(status_code=404)
    return run


@router.get("/{id}", name="agent_runs:get")
async def get(
    request: Request,
    id: UUID4,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> None:
    run = await _get_or_404(session, id)

    org_slug = (
        run.org_snapshot.get("slug", "—") if run.org_snapshot else "—"
    )

    with layout(
        request,
        [
            ("Agent Runs", str(request.url_for("agent_runs:list"))),
            (f"{org_slug} — {run.context}", str(request.url)),
        ],
        "agent_runs:get",
    ):
        with tag.div(classes="flex flex-col gap-4"):
            _render_header(run, org_slug)
            with tag.div(classes="grid grid-cols-1 lg:grid-cols-2 gap-4"):
                with tag.div(classes="flex flex-col gap-4"):
                    _render_final_report_card(run)
                    _render_org_snapshot_card(run)
                with tag.div(classes="flex flex-col gap-4"):
                    _render_events_card(run)
                    _render_llm_calls_card(run)


def _render_header(
    run: OrganizationReviewAgentRun, org_slug: str
) -> None:
    with tag.div(classes="flex items-center gap-3"):
        with tag.h1(classes="text-3xl"):
            text(org_slug)
        _context_badge(run.context)
        _triggered_by_badge(run.triggered_by)
        _status_badge(run.status)
    with tag.div(
        classes="text-sm text-base-content/70 font-mono flex gap-4"
    ):
        text(f"run_id: {run.id}")
        text(f"created: {run.created_at.isoformat(timespec='seconds')}")
        if run.completed_at is not None:
            text(
                f"completed: {run.completed_at.isoformat(timespec='seconds')}"
            )


def _render_final_report_card(run: OrganizationReviewAgentRun) -> None:
    with tag.div(classes="card bg-base-100 shadow"):
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title text-lg"):
                text("Final Report")
            if run.final_report is None:
                with tag.div(classes="text-base-content/60"):
                    text("Not yet produced.")
                return
            verdict = run.final_report.get("verdict", "—")
            with tag.div(classes="flex items-center gap-2 mb-2"):
                with tag.span(classes="font-semibold"):
                    text("Verdict:")
                _verdict_badge(verdict)
            for field_label, field_key in (
                ("Summary (internal)", "summary"),
                ("Merchant summary", "merchant_summary"),
                ("Recommended action", "recommended_action"),
            ):
                value = run.final_report.get(field_key, "")
                if not value:
                    continue
                with tag.div(classes="mt-2"):
                    with tag.div(
                        classes="text-xs text-base-content/60 uppercase"
                    ):
                        text(field_label)
                    with tag.p(classes="text-sm"):
                        text(value)


def _render_org_snapshot_card(run: OrganizationReviewAgentRun) -> None:
    with tag.div(classes="card bg-base-100 shadow"):
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title text-lg"):
                text("Organization Snapshot")
            if run.org_snapshot is None:
                with tag.div(classes="text-base-content/60"):
                    text("Not captured.")
                return
            _render_kv_table(run.org_snapshot)


def _render_events_card(run: OrganizationReviewAgentRun) -> None:
    with tag.div(classes="card bg-base-100 shadow"):
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title text-lg"):
                text(f"Events ({len(run.events)})")
            if not run.events:
                with tag.div(classes="text-base-content/60"):
                    text("No events yet.")
                return
            with tag.div(
                classes="font-mono text-xs whitespace-pre overflow-auto max-h-96"
            ):
                for event in run.events:
                    text(_format_event(event))
                    text("\n")


def _render_llm_calls_card(run: OrganizationReviewAgentRun) -> None:
    with tag.div(classes="card bg-base-100 shadow"):
        with tag.div(classes="card-body"):
            with tag.h2(classes="card-title text-lg"):
                text(f"LLM Calls ({len(run.llm_calls)})")
            if not run.llm_calls:
                with tag.div(classes="text-base-content/60"):
                    text("No LLM calls recorded.")
                return
            with tag.table(classes="table table-zebra table-xs"):
                with tag.thead():
                    with tag.tr():
                        for header in (
                            "Agent",
                            "Model",
                            "Input",
                            "Output",
                            "Cost USD",
                            "Duration ms",
                        ):
                            with tag.th():
                                text(header)
                with tag.tbody():
                    for call in run.llm_calls:
                        with tag.tr():
                            with tag.td():
                                text(str(call.get("agent", "—")))
                            with tag.td():
                                text(str(call.get("model", "—")))
                            with tag.td(classes="text-right"):
                                text(str(call.get("input_tokens", "—")))
                            with tag.td(classes="text-right"):
                                text(str(call.get("output_tokens", "—")))
                            with tag.td(classes="text-right"):
                                cost = call.get("cost_usd")
                                text(
                                    f"${cost:.4f}"
                                    if isinstance(cost, (int, float))
                                    else "—"
                                )
                            with tag.td(classes="text-right"):
                                text(str(call.get("duration_ms", "—")))


def _render_kv_table(payload: dict[str, Any]) -> None:
    with tag.table(classes="table table-xs"):
        with tag.tbody():
            for k, v in payload.items():
                with tag.tr():
                    with tag.td(
                        classes="font-mono text-xs whitespace-nowrap"
                    ):
                        text(k)
                    with tag.td(classes="text-xs break-all"):
                        text(_stringify(v))


def _stringify(v: Any) -> str:
    if v is None:
        return "—"
    if isinstance(v, str):
        return v
    return json.dumps(v, default=str, sort_keys=True)


def _format_event(event: dict[str, Any]) -> str:
    """Render a single event as a one-line ``key=value`` summary."""

    parts = [f"[{event.get('at', '—')}]", event.get("kind", "unknown")]
    for k, v in event.items():
        if k in ("at", "kind"):
            continue
        parts.append(f"{k}={_stringify(v)}")
    return " ".join(parts)
