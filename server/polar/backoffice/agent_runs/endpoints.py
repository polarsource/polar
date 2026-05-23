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
from polar.models.organization_review_signal_history import (
    OrganizationReviewSignalHistory,
    SignalResolution,
)
from polar.organization_review_agent.service import (
    organization_review_agent_service,
)
from polar.organization_review_agent.signal_history_repository import (
    OrganizationReviewSignalHistoryRepository,
)
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)

from ..dependencies import UserSession, get_admin
from ..layout import layout
from ..responses import HXRedirectResponse
from ..toast import add_toast

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

    history_repo = OrganizationReviewSignalHistoryRepository.from_session(
        session
    )
    signals = await history_repo.list_for_run(run.id)

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
            # Signals card spans both columns at the top: it's the
            # actionable content. Reviewers click chips inline.
            _render_signals_card(request, run, signals)
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


def _render_signals_card(
    request: Request,
    run: OrganizationReviewAgentRun,
    signals: Sequence[OrganizationReviewSignalHistory],
) -> None:
    """Per-signal review chips: Real concern / False positive / Retire.

    Each signal is one row; the reviewer clicks a button to flip
    ``resolution`` to APPROVED / DISCARDED. A ≥3-char reason is
    required on the form; the row HTMX-swaps in place on success.

    Retired signals render dimmed but stay visible — the audit trail
    is the point of the row.
    """

    with tag.div(classes="card bg-base-100 shadow", id=f"signals-{run.id}"):
        with tag.div(classes="card-body"):
            with tag.div(classes="flex items-center justify-between mb-2"):
                with tag.h2(classes="card-title text-lg"):
                    text(f"Signals ({len(signals)})")
                if signals:
                    pending_count = sum(
                        1
                        for s in signals
                        if s.resolution == SignalResolution.PENDING
                        and s.retired_at is None
                    )
                    with tag.span(classes="text-sm text-base-content/70"):
                        text(f"{pending_count} pending review")

            if not signals:
                with tag.div(classes="text-base-content/60 text-sm"):
                    text(
                        "No signals emitted for this run "
                        "(Decide returned APPROVE with no concerns)."
                    )
                return

            with tag.div(classes="flex flex-col gap-3"):
                for signal in signals:
                    _render_signal_row(request, signal)


def _render_signal_row(
    request: Request, signal: OrganizationReviewSignalHistory
) -> None:
    row_id = f"signal-{signal.id}"
    is_retired = signal.retired_at is not None
    is_pending = (
        signal.resolution == SignalResolution.PENDING and not is_retired
    )
    severity_class = {
        "low": "border-l-base-300",
        "medium": "border-l-warning",
        "high": "border-l-error",
    }.get(signal.severity, "border-l-base-300")

    container_classes = (
        f"p-3 border border-base-200 border-l-4 {severity_class} rounded"
    )
    if is_retired:
        container_classes += " opacity-60"

    with tag.div(classes=container_classes, id=row_id):
        # Kind + severity + resolution badge row
        with tag.div(classes="flex items-center justify-between gap-2"):
            with tag.div(classes="flex items-center gap-2 flex-wrap"):
                with tag.span(classes="font-mono text-xs font-semibold"):
                    text(signal.kind)
                with tag.div(
                    classes=(
                        "badge badge-sm "
                        + {
                            "low": "badge-ghost",
                            "medium": "badge-warning",
                            "high": "badge-error",
                        }.get(signal.severity, "badge-ghost")
                    )
                ):
                    text(signal.severity)
                _render_resolution_badge(signal.resolution, is_retired)

        # Summary
        with tag.p(classes="text-sm mt-2"):
            text(signal.summary)

        # Evidence (collapsible)
        if signal.evidence:
            with tag.details(classes="mt-2"):
                with tag.summary(
                    classes="text-xs text-base-content/60 cursor-pointer"
                ):
                    text("evidence")
                with tag.pre(
                    classes=(
                        "text-xs bg-base-200 p-2 rounded mt-1 overflow-auto"
                    )
                ):
                    text(
                        json.dumps(
                            signal.evidence, indent=2, default=str
                        )
                    )

        # Reviewer reason (if already resolved)
        if signal.reviewer_reason:
            with tag.div(
                classes="text-xs mt-2 italic text-base-content/70"
            ):
                text(f"reviewer: {signal.reviewer_reason}")

        # Action buttons — only on pending, non-retired signals
        if is_pending:
            _render_signal_action_form(request, signal)
        elif not is_retired:
            # Already adjudicated — offer retire (mark no-longer-
            # representative).
            _render_signal_retire_form(request, signal)


def _render_resolution_badge(
    resolution: SignalResolution, is_retired: bool
) -> None:
    if is_retired:
        with tag.div(classes="badge badge-sm badge-neutral"):
            text("retired")
        return
    variant = {
        SignalResolution.PENDING: "badge-ghost",
        SignalResolution.APPROVED: "badge-success",
        SignalResolution.DISCARDED: "badge-info",
    }.get(resolution, "badge-ghost")
    label = {
        SignalResolution.PENDING: "pending",
        SignalResolution.APPROVED: "real concern",
        SignalResolution.DISCARDED: "false positive",
    }.get(resolution, resolution.value)
    with tag.div(classes=f"badge badge-sm {variant}"):
        text(label)


def _render_signal_action_form(
    request: Request, signal: OrganizationReviewSignalHistory
) -> None:
    action_url = str(
        request.url_for("agent_runs:resolve_signal", id=signal.id)
    )
    with tag.form(
        method="post",
        action=action_url,
        classes="mt-3 flex flex-col gap-2",
    ):
        with tag.textarea(
            name="reason",
            classes="textarea textarea-bordered textarea-sm",
            placeholder=(
                "Why? (e.g. confirmed via payouts ticket, false positive — "
                "merchant resolved this in last appeal)"
            ),
            required=True,
            minlength="3",
            rows="2",
        ):
            pass
        with tag.div(classes="flex gap-2"):
            with tag.button(
                type="submit",
                name="resolution",
                value=SignalResolution.APPROVED.value,
                classes="btn btn-sm btn-success",
            ):
                text("Real concern")
            with tag.button(
                type="submit",
                name="resolution",
                value=SignalResolution.DISCARDED.value,
                classes="btn btn-sm btn-outline",
            ):
                text("False positive")


def _render_signal_retire_form(
    request: Request, signal: OrganizationReviewSignalHistory
) -> None:
    """Retire: mark a resolved row as no-longer-representative."""

    action_url = str(
        request.url_for("agent_runs:retire_signal", id=signal.id)
    )
    with tag.form(
        method="post", action=action_url, classes="mt-3 flex gap-2"
    ):
        with tag.input(
            type="text",
            name="reason",
            classes="input input-bordered input-xs flex-1",
            placeholder=(
                "Why retire? (e.g. merchant changed business model)"
            ),
            required=True,
            minlength="3",
        ):
            pass
        with tag.button(
            type="submit", classes="btn btn-xs btn-ghost"
        ):
            text("Retire memory")


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


# ---------------------------------------------------------------------------
# Signal resolution endpoints
# ---------------------------------------------------------------------------


async def _get_signal_or_404(
    session: AsyncSession, signal_id: UUID4
) -> OrganizationReviewSignalHistory:
    repository = OrganizationReviewSignalHistoryRepository.from_session(
        session
    )
    signal = await repository.get_by_id(signal_id)
    if signal is None:
        raise HTTPException(status_code=404)
    return signal


@router.post("/signals/{id}/resolve", name="agent_runs:resolve_signal")
async def resolve_signal(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
    user_session: UserSession = Depends(get_admin),
) -> Any:
    """Reviewer clicked 'Real concern' or 'False positive'.

    Form: ``resolution`` (``approved`` | ``discarded``) +
    ``reason`` (≥3 chars). On success redirect back to the
    agent-run detail page; toast on validation failure.
    """

    signal = await _get_signal_or_404(session, id)

    form = await request.form()
    raw_resolution = str(form.get("resolution", "")).strip()
    reason = str(form.get("reason", "")).strip()

    try:
        resolution = SignalResolution(raw_resolution)
    except ValueError:
        await add_toast(
            request,
            f"Unknown resolution {raw_resolution!r}.",
            "error",
        )
        return HXRedirectResponse(
            request,
            str(request.url_for("agent_runs:get", id=signal.agent_run_id)),
        )

    if resolution == SignalResolution.PENDING:
        await add_toast(
            request,
            "Can't set a signal back to pending; retire instead.",
            "error",
        )
        return HXRedirectResponse(
            request,
            str(request.url_for("agent_runs:get", id=signal.agent_run_id)),
        )

    try:
        await organization_review_agent_service.resolve_signal(
            session,
            signal,
            resolution=resolution,
            reviewer_reason=reason,
            reviewer_user_id=user_session.user.id,
        )
    except ValueError as exc:
        await add_toast(request, str(exc), "error")
        return HXRedirectResponse(
            request,
            str(request.url_for("agent_runs:get", id=signal.agent_run_id)),
        )

    await add_toast(
        request,
        f"Signal {signal.kind} marked {resolution.value}.",
        "success",
    )
    return HXRedirectResponse(
        request,
        str(request.url_for("agent_runs:get", id=signal.agent_run_id)),
    )


@router.post("/signals/{id}/retire", name="agent_runs:retire_signal")
async def retire_signal(
    request: Request,
    id: UUID4,
    session: AsyncSession = Depends(get_db_session),
    user_session: UserSession = Depends(get_admin),
) -> Any:
    """Reviewer marked a resolved signal as no-longer-representative.

    Idempotent: a row that's already retired silently no-ops.
    """

    signal = await _get_signal_or_404(session, id)
    form = await request.form()
    reason = str(form.get("reason", "")).strip()

    if len(reason) < 3:
        await add_toast(
            request,
            "Provide at least a 3-character retire reason.",
            "error",
        )
        return HXRedirectResponse(
            request,
            str(request.url_for("agent_runs:get", id=signal.agent_run_id)),
        )

    await organization_review_agent_service.retire_signal(
        session,
        signal,
        reviewer_user_id=user_session.user.id,
        reason=reason,
    )
    await add_toast(
        request,
        f"Signal {signal.kind} memory retired.",
        "success",
    )
    return HXRedirectResponse(
        request,
        str(request.url_for("agent_runs:get", id=signal.agent_run_id)),
    )
