"""Minimal hand-rolled FSM for v2 agent runs.

Three nodes: ``TriageNode`` → ``InvestigateNode`` → ``DecideNode``.
Deliberately small + hand-rolled so the v2 module does not pull in
pydantic-graph as a new dependency for the initial slice. The trade-
off is no library-provided snapshot replay; instead each node writes
``state_snapshot`` to the run row on entry and exit, and the driver's
resume path picks up at the last persisted ``current_node``.

Subsequent slices replace the stub Decide with a real LLM call (Slice
2 calibration) and add ``AwaitDenyConfirmNode`` / ``RecheckNode`` /
``AwaitMerchantNode`` (Slices 1/5). The driver's per-node entry/exit
protocol stays the same.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Protocol, runtime_checkable
from uuid import UUID

import structlog

from polar.kit.utils import utc_now
from polar.models.organization import Organization
from polar.models.organization_review_agent_run import (
    AgentRunStatus,
    OrganizationReviewAgentRun,
)
from polar.postgres import AsyncSession

from .lanes import lanes_for_context
from .lanes.base import LaneRunContext
from .repository import OrganizationReviewAgentRunRepository
from .schemas import (
    AgentVerdict,
    FinalReport,
    LaneFacts,
    RaisedSignal,
    ReviewState,
    Severity,
    SignalKind,
)
from .signal_history_repository import (
    OrganizationReviewSignalHistoryRepository,
)
from .taxonomy import spec_for

log = structlog.get_logger(__name__)


# ---------------------------------------------------------------------------
# Node protocol + deps
# ---------------------------------------------------------------------------


@dataclass(slots=True)
class GraphDeps:
    """Non-serialisable handles passed to each node.

    Mirrors ``LaneRunContext`` for cross-cutting access; the lane's
    own context is constructed from this in ``InvestigateNode.run``.
    Kept off ``ReviewState`` so the state stays JSON-roundtrippable.
    """

    organization: Organization
    session: AsyncSession
    run: OrganizationReviewAgentRun


@runtime_checkable
class GraphNode(Protocol):
    """A graph node: pure-function over state, may schedule work.

    ``run`` returns either a string naming the next node (must exist in
    ``NODE_REGISTRY``) or ``None`` to terminate the graph. Returning
    ``None`` from a node marks the run terminal — the driver flips
    status to COMPLETED / FAILED / AWAITING_HUMAN based on the node's
    own bookkeeping.
    """

    name: str

    async def run(
        self, state: ReviewState, deps: GraphDeps
    ) -> str | None:
        """Execute this node. Return the next node name or ``None``."""
        ...


# ---------------------------------------------------------------------------
# Triage node
# ---------------------------------------------------------------------------


class TriageNode:
    """Decide which lanes to investigate.

    Slice 0/1 selects every lane registered for the current context.
    Slice 2 replaces this with an LLM-driven selector that drops
    irrelevant lanes to cut cost (the design plan's "dead
    ``build_triage_agent`` replacement").
    """

    name = "triage"

    async def run(
        self, state: ReviewState, deps: GraphDeps
    ) -> str | None:
        lanes = lanes_for_context(state.context)
        state.lanes_enabled = [lane.name for lane in lanes]
        log.info(
            "organization_review_agent.triage.completed",
            run_id=str(deps.run.id),
            lanes_enabled=state.lanes_enabled,
        )
        return InvestigateNode.name


# ---------------------------------------------------------------------------
# Investigate node
# ---------------------------------------------------------------------------


class InvestigateNode:
    """Run every triaged lane in parallel + collect facts + signals.

    Lane failures are isolated: one lane's exception does not poison
    the others. A failing lane appears in ``events`` as a
    ``lane_failed`` entry; its signals are simply absent. The driver
    does not flip the run to FAILED on lane errors — that is reserved
    for outright graph crashes (e.g. DB connectivity).
    """

    name = "investigate"

    async def run(
        self, state: ReviewState, deps: GraphDeps
    ) -> str | None:
        lanes = [
            lane
            for lane in lanes_for_context(state.context)
            if lane.name in state.lanes_enabled
        ]

        async def _run_one(lane):  # type: ignore[no-untyped-def]
            ctx = LaneRunContext(
                organization=deps.organization,
                session=deps.session,
                review_context=state.context,
            )
            try:
                enabled = await lane.is_enabled(ctx)
            except Exception:
                log.exception(
                    "organization_review_agent.lane.is_enabled_failed",
                    lane=lane.name,
                    run_id=str(deps.run.id),
                )
                return lane.name, None, []
            if not enabled:
                return lane.name, None, []
            try:
                result = await lane.run(ctx)
            except Exception:
                log.exception(
                    "organization_review_agent.lane.run_failed",
                    lane=lane.name,
                    run_id=str(deps.run.id),
                )
                return lane.name, None, []
            return lane.name, result.facts, list(result.signals)

        results = await asyncio.gather(*(_run_one(lane) for lane in lanes))

        new_findings: dict[str, LaneFacts] = dict(state.findings)
        new_signals: list[RaisedSignal] = list(state.raised_signals)
        for lane_name, facts, signals in results:
            if facts is not None:
                new_findings[lane_name] = facts
            new_signals.extend(signals)
        state.findings = new_findings
        state.raised_signals = new_signals

        log.info(
            "organization_review_agent.investigate.completed",
            run_id=str(deps.run.id),
            lanes_run=len(lanes),
            facts_collected=len(new_findings),
            signals_raised=len(new_signals),
        )
        return DecideNode.name


# ---------------------------------------------------------------------------
# Decide node
# ---------------------------------------------------------------------------


class DecideNode:
    """Produce a :class:`FinalReport` from collected signals + facts.

    Slice 0/1 ships a deterministic heuristic with memory weighting:

    1. Look up the per-org memory summary
       ({kind: {approved, discarded}}) from
       ``organization_review_signal_history``.
    2. For each raised signal, adjust its effective severity:
       * If the org has discarded this kind ≥2 times → suppress (the
         kind is consistently a false positive for this org).
       * If the org has discarded this kind exactly 1 time and the
         raised severity is LOW or MEDIUM → downshift (LOW becomes
         suppressed; MEDIUM becomes LOW).
       * If the org has approved this kind → keep raised severity.
       * If no memory → keep raised severity.
    3. Apply the verdict rule on the adjusted severities: any HIGH →
       DENY; any MEDIUM → NEEDS_HUMAN; LOW-only or empty → APPROVE.

    This is a stopgap so v2 produces real verdicts with calibration-
    relevant memory weighting today. Slice 2 part 6 replaces the body
    with an LLM Decide call (pydantic-ai Agent with
    ``output_type=FinalReport``) over the rendered lane facts +
    memory summary.
    """

    name = "decide"

    async def run(
        self, state: ReviewState, deps: GraphDeps
    ) -> str | None:
        memory = await self._load_memory(deps)
        adjusted = self._apply_memory_weights(state.raised_signals, memory)
        verdict, reasoning = self._heuristic_verdict_from_adjusted(
            adjusted, memory_applied=bool(memory)
        )
        merchant_summary = self._heuristic_merchant_summary(
            verdict, adjusted
        )
        decisive = self._decisive_kinds_from_adjusted(adjusted)

        report = FinalReport(
            verdict=verdict,
            summary=reasoning,
            merchant_summary=merchant_summary,
            decisive_signal_kinds=decisive,
            recommended_action=self._heuristic_recommended_action(verdict),
        )
        state.tentative_report = report
        log.info(
            "organization_review_agent.decide.completed",
            run_id=str(deps.run.id),
            verdict=verdict.value,
            signal_count=len(state.raised_signals),
            memory_kinds=sorted(memory.keys()),
        )
        return None  # Terminal — driver finalises.

    async def _load_memory(
        self, deps: GraphDeps
    ) -> dict[str, dict[str, int]]:
        """Read the per-org memory summary used for signal weighting.

        Best-effort: a memory-fetch failure must not bubble out of
        Decide (the org might be brand-new with no history table
        entries). Empty dict is the safe default.
        """

        from .signal_history_repository import (
            OrganizationReviewSignalHistoryRepository,
        )

        try:
            repo = OrganizationReviewSignalHistoryRepository.from_session(
                deps.session
            )
            return await repo.memory_summary_for_organization(
                deps.run.organization_id
            )
        except Exception:
            log.exception(
                "organization_review_agent.decide.memory_load_failed",
                run_id=str(deps.run.id),
            )
            return {}

    @staticmethod
    def _effective_severity(signal: RaisedSignal) -> Severity:
        if signal.severity is not None:
            return signal.severity
        return spec_for(signal.kind).default_severity

    @classmethod
    def _apply_memory_weights(
        cls,
        signals: list[RaisedSignal],
        memory: dict[str, dict[str, int]],
    ) -> list[tuple[RaisedSignal, Severity | None]]:
        """Pair each signal with its memory-adjusted severity.

        ``None`` in the second slot means the signal is suppressed
        outright (e.g. the org has discarded this kind ≥2 times).
        Callers iterate the list and skip None-severity entries.
        """

        adjusted: list[tuple[RaisedSignal, Severity | None]] = []
        for signal in signals:
            raw_severity = cls._effective_severity(signal)
            kind_memory = memory.get(signal.kind.value, {})
            discarded = kind_memory.get("discarded", 0)
            approved = kind_memory.get("approved", 0)

            # Strong false-positive history: suppress.
            if discarded >= 2 and approved == 0:
                adjusted.append((signal, None))
                continue
            # Mild false-positive history: downshift.
            if discarded == 1 and approved == 0:
                if raw_severity == Severity.LOW:
                    adjusted.append((signal, None))
                    continue
                if raw_severity == Severity.MEDIUM:
                    adjusted.append((signal, Severity.LOW))
                    continue
                # HIGH stays HIGH even with one discard — too risky to
                # downshift a HIGH on a single counter-example.
                adjusted.append((signal, raw_severity))
                continue
            adjusted.append((signal, raw_severity))
        return adjusted

    @staticmethod
    def _decisive_kinds_from_adjusted(
        adjusted: list[tuple[RaisedSignal, Severity | None]],
    ) -> list[SignalKind]:
        # Dedupe by kind, preserving signals whose adjusted severity is
        # not None (suppressed signals aren't "decisive").
        seen: list[SignalKind] = []
        for signal, severity in adjusted:
            if severity is None:
                continue
            if signal.kind not in seen:
                seen.append(signal.kind)
        return seen

    def _heuristic_verdict_from_adjusted(
        self,
        adjusted: list[tuple[RaisedSignal, Severity | None]],
        *,
        memory_applied: bool,
    ) -> tuple[AgentVerdict, str]:
        live = [(s, sev) for s, sev in adjusted if sev is not None]
        suppressed = [s for s, sev in adjusted if sev is None]
        memory_note = (
            " (with prior-memory weighting)" if memory_applied else ""
        )

        if not live and not suppressed:
            return (
                AgentVerdict.APPROVE,
                f"No concerning signals across enabled lanes{memory_note}.",
            )
        if not live and suppressed:
            kinds = sorted({s.kind.value for s in suppressed})
            return (
                AgentVerdict.APPROVE,
                "All raised signals were suppressed by prior-memory "
                f"weighting (discarded ≥2x for this org): {', '.join(kinds)}.",
            )

        severities = [sev for _, sev in live]
        if Severity.HIGH in severities:
            high_kinds = sorted(
                {
                    s.kind.value
                    for s, sev in live
                    if sev == Severity.HIGH
                }
            )
            return (
                AgentVerdict.DENY,
                f"High-severity signals raised{memory_note}: "
                + ", ".join(high_kinds),
            )
        if Severity.MEDIUM in severities:
            medium_kinds = sorted(
                {
                    s.kind.value
                    for s, sev in live
                    if sev == Severity.MEDIUM
                }
            )
            return (
                AgentVerdict.NEEDS_HUMAN,
                f"Medium-severity signals raised{memory_note}: "
                + ", ".join(medium_kinds),
            )
        return (
            AgentVerdict.APPROVE,
            f"Only low-severity signals raised{memory_note}; safe to proceed.",
        )

    def _heuristic_verdict(
        self, signals: list[RaisedSignal]
    ) -> tuple[AgentVerdict, str]:
        """Legacy memory-free entry point.

        Kept for the Slice 2 unit tests pinning the heuristic
        boundaries in isolation. Production code goes through
        :meth:`_heuristic_verdict_from_adjusted` via :meth:`run`.
        """

        adjusted = [
            (s, self._effective_severity(s)) for s in signals
        ]
        return self._heuristic_verdict_from_adjusted(
            adjusted, memory_applied=False
        )

    @staticmethod
    def _effective_severity(signal: RaisedSignal) -> Severity:
        if signal.severity is not None:
            return signal.severity
        return spec_for(signal.kind).default_severity

    def _heuristic_verdict(
        self, signals: list[RaisedSignal]
    ) -> tuple[AgentVerdict, str]:
        if not signals:
            return (
                AgentVerdict.APPROVE,
                "No concerning signals across enabled lanes.",
            )
        severities = [self._effective_severity(s) for s in signals]
        if Severity.HIGH in severities:
            high_kinds = sorted(
                {
                    s.kind.value
                    for s in signals
                    if self._effective_severity(s) == Severity.HIGH
                }
            )
            return (
                AgentVerdict.DENY,
                "High-severity signals raised: " + ", ".join(high_kinds),
            )
        if Severity.MEDIUM in severities:
            medium_kinds = sorted(
                {
                    s.kind.value
                    for s in signals
                    if self._effective_severity(s) == Severity.MEDIUM
                }
            )
            return (
                AgentVerdict.NEEDS_HUMAN,
                "Medium-severity signals raised: "
                + ", ".join(medium_kinds),
            )
        return (
            AgentVerdict.APPROVE,
            "Only low-severity signals raised; safe to proceed.",
        )

    @staticmethod
    def _heuristic_merchant_summary(
        verdict: AgentVerdict,
        adjusted: list[tuple[RaisedSignal, Severity | None]] | list[RaisedSignal],
    ) -> str:
        # Accept either the adjusted-tuple form (from run()) or the
        # legacy bare-signal form (from the unit-test entry point); the
        # merchant_summary content does not depend on signals today.
        if verdict == AgentVerdict.APPROVE:
            return ""
        if verdict == AgentVerdict.DENY:
            return (
                "We weren't able to approve your account at this time. "
                "If you believe this was a mistake, please file an appeal."
            )
        return ""

    @staticmethod
    def _heuristic_recommended_action(verdict: AgentVerdict) -> str:
        if verdict == AgentVerdict.APPROVE:
            return "Activate the organization."
        if verdict == AgentVerdict.DENY:
            return (
                "Deny submission. Review the signal evidence on the "
                "agent-run detail page before committing."
            )
        return (
            "Park for human review. The medium-severity signals warrant "
            "a manual second look before activation."
        )


# ---------------------------------------------------------------------------
# Node registry + driver
# ---------------------------------------------------------------------------


NODE_REGISTRY: dict[str, GraphNode] = {
    TriageNode.name: TriageNode(),
    InvestigateNode.name: InvestigateNode(),
    DecideNode.name: DecideNode(),
}


async def execute_graph(
    session: AsyncSession,
    run: OrganizationReviewAgentRun,
    organization: Organization,
) -> None:
    """Drive the FSM to a terminal state.

    Idempotent on resume: re-enters at ``run.current_node`` if set,
    otherwise starts at :class:`TriageNode`. Each node's state delta
    flushes to ``state_snapshot`` after the node returns so a worker
    crash mid-graph loses at most one node's worth of progress.

    Cooperative cancellation: between nodes, the run row is re-read
    and the loop bails if status flipped to CANCELLED.
    """

    repository = OrganizationReviewAgentRunRepository.from_session(session)
    deps = GraphDeps(organization=organization, session=session, run=run)

    state = _hydrate_state(run, organization_id=organization.id)

    next_node_name = run.current_node or TriageNode.name

    while next_node_name is not None:
        # Cancellation check (cooperative — does not preempt a node).
        refreshed = await repository.get_by_id(run.id)
        if refreshed is not None and refreshed.status == AgentRunStatus.CANCELLED:
            log.info(
                "organization_review_agent.graph.cancelled_mid_run",
                run_id=str(run.id),
                current_node=next_node_name,
            )
            return

        node = NODE_REGISTRY.get(next_node_name)
        if node is None:
            raise RuntimeError(
                f"Unknown node {next_node_name!r}; "
                f"registered: {sorted(NODE_REGISTRY)}"
            )

        run.current_node = node.name
        await repository.touch_heartbeat(run)
        await repository.append_event(
            run,
            {
                "kind": "node_entered",
                "node": node.name,
                "at": utc_now().isoformat(),
            },
        )

        try:
            next_node_name = await node.run(state, deps)
        except Exception as exc:
            log.exception(
                "organization_review_agent.graph.node_failed",
                run_id=str(run.id),
                node=node.name,
            )
            run.status = AgentRunStatus.FAILED
            run.completed_at = utc_now()
            run.current_node = None
            await repository.append_event(
                run,
                {
                    "kind": "node_failed",
                    "node": node.name,
                    "at": utc_now().isoformat(),
                    "error": str(exc),
                },
            )
            await session.flush()
            return

        run.state_snapshot = state.model_dump(mode="json")
        await repository.touch_heartbeat(run)
        await repository.append_event(
            run,
            {
                "kind": "node_completed",
                "node": node.name,
                "at": utc_now().isoformat(),
            },
        )

    # Terminal: a node returned None. The driver finalises based on the
    # tentative report's verdict.
    if state.tentative_report is None:
        run.status = AgentRunStatus.FAILED
        run.completed_at = utc_now()
        run.current_node = None
        await repository.append_event(
            run,
            {
                "kind": "graph_terminated_without_report",
                "at": utc_now().isoformat(),
            },
        )
        await session.flush()
        return

    run.final_report = state.tentative_report.model_dump(mode="json")
    run.status = AgentRunStatus.COMPLETED
    run.completed_at = utc_now()
    run.current_node = None

    # Persist emitted signals to cross-run memory. Reviewers later flip
    # rows to APPROVED/DISCARDED via the agent-run page; subsequent
    # Decide invocations on the same org use the per-kind counts to
    # weight new signals.
    if state.raised_signals:
        history_repo = OrganizationReviewSignalHistoryRepository.from_session(
            session
        )
        await history_repo.persist_signals_from_run(
            organization_id=run.organization_id,
            agent_run_id=run.id,
            signals=state.raised_signals,
        )

    await session.flush()


def _hydrate_state(
    run: OrganizationReviewAgentRun, *, organization_id: UUID
) -> ReviewState:
    """Reconstruct :class:`ReviewState` from the run row.

    On a fresh run the snapshot is None and we build an empty state
    from the run's context + triggered_by. On resume we rehydrate from
    the JSONB snapshot; pydantic validates that the schema is still
    compatible.
    """

    if run.state_snapshot is not None:
        return ReviewState.model_validate(run.state_snapshot)
    return ReviewState(
        organization_id=organization_id,
        context=run.context,
        triggered_by=run.triggered_by,
    )


__all__ = [
    "DecideNode",
    "GraphDeps",
    "GraphNode",
    "InvestigateNode",
    "NODE_REGISTRY",
    "TriageNode",
    "execute_graph",
]