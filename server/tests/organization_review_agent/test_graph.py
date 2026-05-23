"""Unit tests for the v2 graph nodes + heuristic Decide.

Slice 0/1 ships a deterministic Decide; Slice 2 swaps it for an LLM
call. These tests pin the *current* heuristic's contract so the LLM
swap shows up as a deliberate diff rather than a silent regression.
"""

from __future__ import annotations

import pytest

from polar.organization_review_agent.graph import DecideNode
from polar.organization_review_agent.schemas import (
    AgentVerdict,
    RaisedSignal,
    ReviewState,
    Severity,
    SignalKind,
)
from polar.organization_review_agent.taxonomy import spec_for


class TestDecideHeuristic:
    """The Slice 0/1 deterministic Decide."""

    def _decide(
        self, signals: list[RaisedSignal]
    ) -> tuple[AgentVerdict, str]:
        node = DecideNode()
        return node._heuristic_verdict(signals)

    def test_no_signals_returns_approve(self) -> None:
        verdict, reasoning = self._decide([])
        assert verdict == AgentVerdict.APPROVE
        assert "No concerning signals" in reasoning

    def test_low_only_returns_approve(self) -> None:
        verdict, reasoning = self._decide(
            [
                RaisedSignal(
                    kind=SignalKind.HUMAN_OVERRIDE_HISTORY,
                    severity=Severity.LOW,
                    summary="prior override",
                )
            ]
        )
        assert verdict == AgentVerdict.APPROVE
        assert "low-severity" in reasoning.lower()

    def test_any_medium_forces_needs_human(self) -> None:
        verdict, reasoning = self._decide(
            [
                RaisedSignal(
                    kind=SignalKind.PRIOR_DENIALS_PRESENT,
                    severity=Severity.MEDIUM,
                    summary="2 prior denials",
                )
            ]
        )
        assert verdict == AgentVerdict.NEEDS_HUMAN
        assert "prior_denials_present" in reasoning

    def test_any_high_forces_deny(self) -> None:
        """A single HIGH-severity signal forces DENY regardless of
        other signals' severities. This is the conservative bias the
        plan calls for during shadow: false-positive DENYs are visible
        and reversible; false-negative APPROVES are silent + risky.
        """

        verdict, reasoning = self._decide(
            [
                RaisedSignal(
                    kind=SignalKind.USER_BLOCKED,
                    severity=Severity.HIGH,
                    summary="admin user blocked",
                ),
                RaisedSignal(
                    kind=SignalKind.HUMAN_OVERRIDE_HISTORY,
                    severity=Severity.LOW,
                    summary="prior override",
                ),
            ]
        )
        assert verdict == AgentVerdict.DENY
        assert "user_blocked" in reasoning

    def test_severity_falls_back_to_registry_default(self) -> None:
        """A signal that omits ``severity`` uses the registry default.

        The history lane emits with explicit severity; later lanes may
        rely on the default. This test pins the fallback so a Slice 0
        registry edit + ``severity=None`` emission stays consistent.
        """

        # PRIOR_BLOCKS_PRESENT defaults to HIGH per registry.
        spec = spec_for(SignalKind.PRIOR_BLOCKS_PRESENT)
        assert spec.default_severity == Severity.HIGH

        verdict, _ = self._decide(
            [
                RaisedSignal(
                    kind=SignalKind.PRIOR_BLOCKS_PRESENT,
                    summary="user owns blocked org",
                )
            ]
        )
        assert verdict == AgentVerdict.DENY


class TestDecisiveSignalKinds:
    """The FinalReport's ``decisive_signal_kinds`` field carries the
    ranked list of signal kinds Decide flagged as load-bearing in the
    verdict — used by Slice 1 auto-take and Slice 4 merchant disclosure.
    """

    @pytest.mark.asyncio
    async def test_decisive_kinds_populated_from_signals(self) -> None:
        from polar.organization_review_agent.graph import (
            DecideNode,
            GraphDeps,
        )

        # We don't actually need real deps for Decide — it only reads
        # state.raised_signals.
        node = DecideNode()
        state = ReviewState(
            organization_id=_dummy_org_id(),
            context="submission",
            raised_signals=[
                RaisedSignal(
                    kind=SignalKind.PRIOR_DENIALS_PRESENT,
                    severity=Severity.MEDIUM,
                    summary="2 denials",
                ),
                RaisedSignal(
                    kind=SignalKind.USER_BLOCKED,
                    severity=Severity.HIGH,
                    summary="admin blocked",
                ),
            ],
        )
        # Construct a deps object with None handles — DecideNode does
        # not touch them.
        deps = GraphDeps(
            organization=None,  # type: ignore[arg-type]
            session=None,  # type: ignore[arg-type]
            run=None,  # type: ignore[arg-type]
        )
        result = await node.run(state, deps)

        assert result is None  # Decide terminates the graph.
        assert state.tentative_report is not None
        assert state.tentative_report.verdict == AgentVerdict.DENY
        # Decisive kinds: HIGH ranked first (the heuristic dedupes by
        # severity, so we expect the unique kinds).
        kinds = state.tentative_report.decisive_signal_kinds
        assert SignalKind.USER_BLOCKED in kinds
        assert SignalKind.PRIOR_DENIALS_PRESENT in kinds


def _dummy_org_id():  # type: ignore[no-untyped-def]
    """Stable test UUID — value doesn't matter, only that pydantic accepts it."""

    from uuid import UUID

    return UUID("00000000-0000-0000-0000-000000000001")
