"""Payments lane: refund / dispute rates + risk score percentiles.

Only meaningful for contexts that have accumulated payment volume —
i.e. THRESHOLD / MANUAL / CHARGEBACK_RISK (Slice 7). For SUBMISSION
runs the lane skips early via :meth:`is_enabled`.

Threshold values live in
:mod:`polar.organization_review.thresholds` (the legacy module) — kept
in one place so the AI prompt addenda and the v2 signals agree on
what "high" means.
"""

from __future__ import annotations

from typing import ClassVar

from polar.organization_review.repository import OrganizationReviewRepository
from polar.organization_review.thresholds import (
    DISPUTE_RATE,
    P50_RISK,
    P90_RISK,
    REFUND_RATE,
)

from ..schemas import LaneFacts, RaisedSignal, Severity, SignalKind
from .base import LaneRunContext, LaneRunResult


# Contexts where payment volume exists. SUBMISSION skips; THRESHOLD /
# MANUAL run the full lane. Slice 7 adds CHARGEBACK_RISK as the
# strongest trigger for this lane.
_RELEVANT_CONTEXTS: frozenset[str] = frozenset(
    {"threshold", "manual", "chargeback_risk"}
)


class PaymentsLane:
    """Computes per-org payment metrics + emits threshold-breach signals."""

    name: ClassVar[str] = "payments"

    async def is_enabled(self, ctx: LaneRunContext) -> bool:
        return ctx.review_context in _RELEVANT_CONTEXTS

    async def run(self, ctx: LaneRunContext) -> LaneRunResult:
        review_repo = OrganizationReviewRepository.from_session(ctx.session)

        total, succeeded, amount = await review_repo.get_payment_stats(
            ctx.organization.id
        )
        p50, p90 = await review_repo.get_risk_score_percentiles(
            ctx.organization.id
        )
        refund_count, refund_amount = await review_repo.get_refund_stats(
            ctx.organization.id
        )
        dispute_count, dispute_amount = await review_repo.get_dispute_stats(
            ctx.organization.id
        )

        refund_rate = (
            (refund_count / succeeded * 100) if succeeded > 0 else 0.0
        )
        dispute_rate = (
            (dispute_count / succeeded * 100) if succeeded > 0 else 0.0
        )

        facts = LaneFacts(
            name=self.name,
            payload={
                "total_payments": total,
                "succeeded_payments": succeeded,
                "total_amount_cents": amount,
                "refund_count": refund_count,
                "refund_amount_cents": refund_amount,
                "refund_rate_pct": round(refund_rate, 3),
                "dispute_count": dispute_count,
                "dispute_amount_cents": dispute_amount,
                "dispute_rate_pct": round(dispute_rate, 3),
                "p50_risk_score": p50,
                "p90_risk_score": p90,
            },
        )

        signals: list[RaisedSignal] = []

        signals.extend(
            self._signals_for_refunds(refund_rate, refund_count, succeeded)
        )
        signals.extend(
            self._signals_for_disputes(
                dispute_rate, dispute_count, succeeded
            )
        )
        signals.extend(self._signals_for_risk_scores(p50, p90))

        return LaneRunResult(facts=facts, signals=signals)

    @staticmethod
    def _signals_for_refunds(
        rate: float, count: int, succeeded: int
    ) -> list[RaisedSignal]:
        verdict = REFUND_RATE.evaluate(rate)
        if verdict == "ok":
            return []
        severity = (
            Severity.HIGH if verdict == "crit" else Severity.MEDIUM
        )
        return [
            RaisedSignal(
                kind=SignalKind.HIGH_REFUND_RATE,
                severity=severity,
                summary=(
                    f"Refund rate {rate:.2f}% over last cohort "
                    f"({count}/{succeeded}); threshold "
                    f"warn={REFUND_RATE.warn}% crit={REFUND_RATE.crit}%."
                ),
                evidence={
                    "rate_pct": round(rate, 3),
                    "refund_count": count,
                    "succeeded_count": succeeded,
                    "warn_threshold_pct": REFUND_RATE.warn,
                    "crit_threshold_pct": REFUND_RATE.crit,
                },
            )
        ]

    @staticmethod
    def _signals_for_disputes(
        rate: float, count: int, succeeded: int
    ) -> list[RaisedSignal]:
        verdict = DISPUTE_RATE.evaluate(rate)
        if verdict == "ok":
            return []
        severity = (
            Severity.HIGH if verdict == "crit" else Severity.MEDIUM
        )
        return [
            RaisedSignal(
                kind=SignalKind.HIGH_DISPUTE_RATE,
                severity=severity,
                summary=(
                    f"Dispute rate {rate:.2f}% over last cohort "
                    f"({count}/{succeeded}); threshold "
                    f"warn={DISPUTE_RATE.warn}% crit={DISPUTE_RATE.crit}%."
                ),
                evidence={
                    "rate_pct": round(rate, 3),
                    "dispute_count": count,
                    "succeeded_count": succeeded,
                    "warn_threshold_pct": DISPUTE_RATE.warn,
                    "crit_threshold_pct": DISPUTE_RATE.crit,
                },
            )
        ]

    @staticmethod
    def _signals_for_risk_scores(
        p50: int | None, p90: int | None
    ) -> list[RaisedSignal]:
        signals: list[RaisedSignal] = []
        if p50 is not None:
            verdict = P50_RISK.evaluate(float(p50))
            if verdict != "ok":
                signals.append(
                    RaisedSignal(
                        kind=SignalKind.HIGH_P50_RISK_SCORE,
                        severity=(
                            Severity.HIGH
                            if verdict == "crit"
                            else Severity.MEDIUM
                        ),
                        summary=(
                            f"P50 risk score {p50}; threshold "
                            f"warn={P50_RISK.warn} crit={P50_RISK.crit}."
                        ),
                        evidence={
                            "p50": p50,
                            "warn_threshold": P50_RISK.warn,
                            "crit_threshold": P50_RISK.crit,
                        },
                    )
                )
        if p90 is not None:
            verdict = P90_RISK.evaluate(float(p90))
            if verdict != "ok":
                signals.append(
                    RaisedSignal(
                        kind=SignalKind.HIGH_P90_RISK_SCORE,
                        severity=(
                            Severity.HIGH
                            if verdict == "crit"
                            else Severity.MEDIUM
                        ),
                        summary=(
                            f"P90 risk score {p90}; threshold "
                            f"warn={P90_RISK.warn} crit={P90_RISK.crit}."
                        ),
                        evidence={
                            "p90": p90,
                            "warn_threshold": P90_RISK.warn,
                            "crit_threshold": P90_RISK.crit,
                        },
                    )
                )
        return signals


payments_lane = PaymentsLane()


__all__ = ["PaymentsLane", "payments_lane"]
