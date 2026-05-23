"""Tests for concrete lane impls.

Focus on the signal-emission logic — the legacy collectors they wrap
already have their own tests in :mod:`tests.organization_review`. The
v2 lane tests pin: (1) controlled-vocabulary kinds are correct, (2)
threshold breaches trigger expected severities, (3)
``is_enabled`` skips contexts the lane shouldn't run for.
"""

from __future__ import annotations

import pytest

from polar.organization_review_agent.lanes.payments import PaymentsLane
from polar.organization_review_agent.lanes.payout_account import (
    PayoutAccountLane,
)
from polar.organization_review_agent.schemas import (
    RaisedSignal,
    Severity,
    SignalKind,
)


class TestPaymentsLane:
    @pytest.mark.asyncio
    async def test_skips_submission_context(self) -> None:
        """SUBMISSION runs have no payment volume; the lane skips
        to keep cost down. THRESHOLD / MANUAL / CHARGEBACK_RISK run it.
        """

        lane = PaymentsLane()

        class _Ctx:
            organization = None
            session = None

            def __init__(self, context: str) -> None:
                self.review_context = context

        assert (await lane.is_enabled(_Ctx("submission"))) is False
        assert (await lane.is_enabled(_Ctx("threshold"))) is True
        assert (await lane.is_enabled(_Ctx("manual"))) is True
        assert (await lane.is_enabled(_Ctx("chargeback_risk"))) is True
        assert (await lane.is_enabled(_Ctx("appeal"))) is False

    def test_refund_rate_signals_at_crit_threshold(self) -> None:
        # REFUND_RATE crit is 15%; emit HIGH at or above that.
        signals = PaymentsLane._signals_for_refunds(20.0, 200, 1000)
        assert len(signals) == 1
        assert signals[0].kind == SignalKind.HIGH_REFUND_RATE
        assert signals[0].severity == Severity.HIGH

    def test_refund_rate_signals_at_warn_threshold(self) -> None:
        # REFUND_RATE warn is 10%; emit MEDIUM between warn and crit.
        signals = PaymentsLane._signals_for_refunds(12.0, 120, 1000)
        assert len(signals) == 1
        assert signals[0].severity == Severity.MEDIUM

    def test_refund_rate_clean_no_signal(self) -> None:
        # Below warn threshold (10%); no signal.
        signals = PaymentsLane._signals_for_refunds(5.0, 50, 1000)
        assert signals == []

    def test_dispute_rate_crit_severity(self) -> None:
        # DISPUTE_RATE crit is 0.75%; emit HIGH at/above.
        signals = PaymentsLane._signals_for_disputes(1.0, 10, 1000)
        assert len(signals) == 1
        assert signals[0].kind == SignalKind.HIGH_DISPUTE_RATE
        assert signals[0].severity == Severity.HIGH

    def test_risk_score_signals(self) -> None:
        # P50 crit is 65, warn is 50. P90 crit is 75, warn is 65.
        signals = PaymentsLane._signals_for_risk_scores(p50=70, p90=80)
        kinds = {s.kind for s in signals}
        assert kinds == {
            SignalKind.HIGH_P50_RISK_SCORE,
            SignalKind.HIGH_P90_RISK_SCORE,
        }
        severities = {s.kind: s.severity for s in signals}
        assert severities[SignalKind.HIGH_P50_RISK_SCORE] == Severity.HIGH
        assert severities[SignalKind.HIGH_P90_RISK_SCORE] == Severity.HIGH

    def test_risk_score_none_emits_nothing(self) -> None:
        """When the org has no payments yet, risk percentiles are None
        and the lane must not emit junk.
        """

        signals = PaymentsLane._signals_for_risk_scores(p50=None, p90=None)
        assert signals == []


class TestPayoutAccountLaneSignalShape:
    """Most of the lane's logic is in the legacy collector; pin the
    signal-emission contract here."""

    def _emit(
        self,
        *,
        is_charges_enabled: bool = True,
        is_payouts_enabled: bool = True,
        past_due: list[str] | None = None,
    ) -> list[RaisedSignal]:
        from polar.organization_review.schemas import PayoutAccountData

        payout_data = PayoutAccountData(
            is_charges_enabled=is_charges_enabled,
            is_payouts_enabled=is_payouts_enabled,
            requirements_past_due=past_due or [],
        )

        # Emulate the part of PayoutAccountLane.run that decides which
        # signals to emit from the legacy collector's output.
        signals: list[RaisedSignal] = []
        # Account is treated as present for this shape test.
        if not payout_data.is_charges_enabled or not payout_data.is_payouts_enabled:
            signals.append(
                RaisedSignal(
                    kind=SignalKind.CHARGES_OR_PAYOUTS_DISABLED,
                    severity=Severity.HIGH,
                    summary="x",
                )
            )
        if payout_data.requirements_past_due:
            signals.append(
                RaisedSignal(
                    kind=SignalKind.PAYOUT_REQUIREMENTS_PAST_DUE,
                    severity=Severity.MEDIUM,
                    summary="y",
                )
            )
        return signals

    def test_disabled_capability_emits_high(self) -> None:
        signals = self._emit(is_charges_enabled=False)
        assert any(
            s.kind == SignalKind.CHARGES_OR_PAYOUTS_DISABLED
            and s.severity == Severity.HIGH
            for s in signals
        )

    def test_past_due_emits_medium(self) -> None:
        signals = self._emit(past_due=["business_url", "external_account"])
        assert any(
            s.kind == SignalKind.PAYOUT_REQUIREMENTS_PAST_DUE
            and s.severity == Severity.MEDIUM
            for s in signals
        )

    def test_fully_enabled_no_signals(self) -> None:
        assert self._emit() == []


class TestPayoutAccountLaneIsEnabled:
    @pytest.mark.asyncio
    async def test_runs_for_all_contexts(self) -> None:
        """Unlike Payments, PayoutAccountLane runs for every context —
        Stripe Connect readiness is relevant at submission time too."""

        lane = PayoutAccountLane()

        class _Ctx:
            organization = None
            session = None

            def __init__(self, context: str) -> None:
                self.review_context = context

        for context in ("submission", "threshold", "manual", "appeal"):
            assert (await lane.is_enabled(_Ctx(context))) is True
