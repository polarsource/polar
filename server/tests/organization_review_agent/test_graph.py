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


class TestDecideMemoryWeighting:
    """The memory adjustment table:

    * 0 prior history → use raised severity.
    * 1 discard, 0 approvals → LOW suppressed; MEDIUM → LOW;
      HIGH stays HIGH (too risky to downshift on 1 counter-example).
    * ≥2 discards, 0 approvals → suppress entirely.
    * any approvals → keep raised severity.
    """

    def _apply(
        self,
        signals: list[RaisedSignal],
        memory: dict[str, dict[str, int]],
    ) -> list[tuple[RaisedSignal, Severity | None]]:
        return DecideNode._apply_memory_weights(signals, memory)

    def test_no_memory_passes_through(self) -> None:
        signal = RaisedSignal(
            kind=SignalKind.PRIOR_DENIALS_PRESENT,
            severity=Severity.MEDIUM,
            summary="x",
        )
        adjusted = self._apply([signal], {})
        assert adjusted[0][1] == Severity.MEDIUM

    def test_two_discards_suppresses(self) -> None:
        signal = RaisedSignal(
            kind=SignalKind.PRIOR_DENIALS_PRESENT,
            severity=Severity.MEDIUM,
            summary="x",
        )
        memory = {"prior_denials_present": {"approved": 0, "discarded": 2}}
        adjusted = self._apply([signal], memory)
        assert adjusted[0][1] is None  # suppressed

    def test_one_discard_downshifts_medium_to_low(self) -> None:
        signal = RaisedSignal(
            kind=SignalKind.PRIOR_DENIALS_PRESENT,
            severity=Severity.MEDIUM,
            summary="x",
        )
        memory = {"prior_denials_present": {"approved": 0, "discarded": 1}}
        adjusted = self._apply([signal], memory)
        assert adjusted[0][1] == Severity.LOW

    def test_one_discard_keeps_high(self) -> None:
        """A single counter-example is not enough to downshift HIGH —
        too risky during shadow. ≥2 discards are needed before HIGH
        suppresses (and even then, only if no approvals).
        """

        signal = RaisedSignal(
            kind=SignalKind.USER_BLOCKED,
            severity=Severity.HIGH,
            summary="x",
        )
        memory = {"user_blocked": {"approved": 0, "discarded": 1}}
        adjusted = self._apply([signal], memory)
        assert adjusted[0][1] == Severity.HIGH

    def test_one_discard_suppresses_low(self) -> None:
        signal = RaisedSignal(
            kind=SignalKind.HUMAN_OVERRIDE_HISTORY,
            severity=Severity.LOW,
            summary="x",
        )
        memory = {
            "human_override_history": {"approved": 0, "discarded": 1}
        }
        adjusted = self._apply([signal], memory)
        assert adjusted[0][1] is None

    def test_any_approval_preserves_severity_even_with_discards(self) -> None:
        """The "discarded ≥2 → suppress" rule requires zero prior
        approvals — a kind that's been both confirmed-real AND
        discarded should stay at the raised severity. The mixed
        signal is what humans look at; suppression would hide it.
        """

        signal = RaisedSignal(
            kind=SignalKind.PRIOR_DENIALS_PRESENT,
            severity=Severity.MEDIUM,
            summary="x",
        )
        memory = {"prior_denials_present": {"approved": 1, "discarded": 3}}
        adjusted = self._apply([signal], memory)
        assert adjusted[0][1] == Severity.MEDIUM


class TestDecideHeuristicWithMemory:
    """Verdict assembly takes the memory-adjusted severities."""

    def test_suppressed_all_yields_approve(self) -> None:
        signal = RaisedSignal(
            kind=SignalKind.PRIOR_DENIALS_PRESENT,
            severity=Severity.MEDIUM,
            summary="2 denials",
        )
        node = DecideNode()
        adjusted = node._apply_memory_weights(
            [signal],
            {"prior_denials_present": {"approved": 0, "discarded": 2}},
        )
        verdict, reasoning = node._heuristic_verdict_from_adjusted(
            adjusted, memory_applied=True
        )
        assert verdict == AgentVerdict.APPROVE
        assert "suppressed" in reasoning.lower()

    def test_downshifted_medium_to_low_yields_approve(self) -> None:
        signal = RaisedSignal(
            kind=SignalKind.PRIOR_DENIALS_PRESENT,
            severity=Severity.MEDIUM,
            summary="2 denials",
        )
        node = DecideNode()
        adjusted = node._apply_memory_weights(
            [signal],
            {"prior_denials_present": {"approved": 0, "discarded": 1}},
        )
        verdict, _ = node._heuristic_verdict_from_adjusted(
            adjusted, memory_applied=True
        )
        # Adjusted to LOW → APPROVE (low-only outcome).
        assert verdict == AgentVerdict.APPROVE


class TestDecisiveSignalKinds:
    """The FinalReport's ``decisive_signal_kinds`` field carries the
    ranked list of signal kinds Decide flagged as load-bearing in the
    verdict — used by Slice 1 auto-take and Slice 4 merchant disclosure.
    """

    def test_decisive_kinds_excludes_suppressed(self) -> None:
        """Suppressed signals (memory-driven) are not "decisive"."""

        signals = [
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
        ]
        node = DecideNode()
        # No memory weighting → both kinds decisive.
        adjusted = node._apply_memory_weights(signals, {})
        decisive = node._decisive_kinds_from_adjusted(adjusted)
        assert SignalKind.USER_BLOCKED in decisive
        assert SignalKind.PRIOR_DENIALS_PRESENT in decisive

        # Suppress PRIOR_DENIALS_PRESENT via memory.
        adjusted = node._apply_memory_weights(
            signals,
            {"prior_denials_present": {"approved": 0, "discarded": 2}},
        )
        decisive = node._decisive_kinds_from_adjusted(adjusted)
        assert SignalKind.USER_BLOCKED in decisive
        assert SignalKind.PRIOR_DENIALS_PRESENT not in decisive


def _dummy_org_id():  # type: ignore[no-untyped-def]
    """Stable test UUID — value doesn't matter, only that pydantic accepts it."""

    from uuid import UUID

    return UUID("00000000-0000-0000-0000-000000000001")
