"""Composite priority score for the Review queue.

Sum of four components. Risk, payment health, and fast-mover are each
capped at 25 — they're "tie-breaker" signals on top of the queue's main
sort, which is age in status. Aging is uncapped at 25 (50pts max) so
orgs sitting in the queue past ~10 days naturally outrank fresh orgs
that lack other signals — but a fresh dispute-heavy merchant can still
surface if its other signals stack up. ``compute`` is pure over
primitives — fetching and JSONB parsing live in the caller.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import UTC, datetime

from polar.models import Organization
from polar.organization_review.schemas import PaymentMetrics

# Aging: 2.5 pts per day, capped at 50.
# 10d → 25, 14d → 35, 20d → 50 (cap). Beats any single non-aging signal,
# so a quietly-stale org will rise above an active-but-fresh one.
AGING_DAILY_PTS = 2.5
AGING_MAX_PTS = 50.0

# Other components share this cap; the sum stays meaningful at [0, 125].
SIGNAL_CAP = 25.0

# Risk: AI overall_risk_score is 0..100 (LOW=15, MEDIUM=50, HIGH=85).
# Below MEDIUM, contribute 0 — those are typically re-reviews of approved orgs.
HIGH_RISK_SCORE = 50.0

# Payment health: denominator guards prevent noise on tiny merchants.
MIN_PAYMENTS_FOR_AUTH = 5
MIN_PAYMENTS_FOR_REFUND = 5
LOW_AUTH_RATE = 0.70
HIGH_REFUND_RATE = 0.10

# Fast mover: new org with meaningful volume.
# Log ramp: $1k → 0, $3k → ~12, $10k → 25 (cap).
NEW_ORG_DAYS = 30
FAST_MOVER_MIN_REVENUE_CENTS = 100_000  # $1,000
FAST_MOVER_MIN_PAYMENTS = 25


@dataclass
class Signals:
    aging_pts: float = 0.0
    risk_pts: float = 0.0
    payment_pts: float = 0.0
    fast_mover_pts: float = 0.0

    @property
    def priority(self) -> float:
        return self.aging_pts + self.risk_pts + self.payment_pts + self.fast_mover_pts


def _days_between(later: datetime, earlier: datetime) -> float:
    return max(0.0, (later - earlier).total_seconds() / 86400.0)


def _days_in_status(org: Organization, now: datetime) -> float:
    return _days_between(now, org.status_updated_at or org.created_at)


def _aging_component(org: Organization, now: datetime) -> float:
    return min(_days_in_status(org, now) * AGING_DAILY_PTS, AGING_MAX_PTS)


def _risk_component(risk_score: float | None) -> float:
    # LOW-risk orgs are typically threshold-triggered re-reviews of already-
    # approved orgs — the agent confirming "still fine" shouldn't add priority.
    if risk_score is None or risk_score < HIGH_RISK_SCORE:
        return 0.0
    return (risk_score / 100.0) * SIGNAL_CAP


def _payment_component(metrics: PaymentMetrics | None) -> float:
    if metrics is None:
        return 0.0

    pts = 0.0
    if metrics.total_payments >= MIN_PAYMENTS_FOR_AUTH:
        auth_rate = metrics.succeeded_payments / metrics.total_payments
        if auth_rate < LOW_AUTH_RATE:
            pts += 10.0
    if metrics.total_payments >= MIN_PAYMENTS_FOR_REFUND:
        refund_rate = metrics.refund_count / metrics.total_payments
        if refund_rate >= HIGH_REFUND_RATE:
            pts += 10.0
    if metrics.dispute_count > 0:
        # Disputes are rare and load-bearing on their own.
        pts += 15.0

    return min(pts, SIGNAL_CAP)


def _fast_mover_component(
    org: Organization, metrics: PaymentMetrics | None, now: datetime
) -> float:
    # ``total_balance`` ticks up on every payment (freshest); the agent's
    # ``total_amount_cents`` snapshot can be hours stale — take the larger.
    if metrics is None:
        return 0.0
    age_days = _days_between(now, org.created_at)
    if age_days > NEW_ORG_DAYS:
        return 0.0

    revenue = max(org.total_balance or 0, metrics.total_amount_cents)
    if (
        revenue < FAST_MOVER_MIN_REVENUE_CENTS
        and metrics.total_payments < FAST_MOVER_MIN_PAYMENTS
    ):
        return 0.0

    revenue_for_ramp = max(revenue, FAST_MOVER_MIN_REVENUE_CENTS)
    ramp = math.log10(revenue_for_ramp / FAST_MOVER_MIN_REVENUE_CENTS)
    return min(ramp, 1.0) * SIGNAL_CAP


def compute(
    org: Organization,
    *,
    metrics: PaymentMetrics | None = None,
    risk_score: float | None = None,
    now: datetime | None = None,
) -> Signals:
    """Compute the priority breakdown for an org in the Review queue."""
    if now is None:
        now = datetime.now(UTC)

    return Signals(
        aging_pts=_aging_component(org, now),
        risk_pts=_risk_component(risk_score),
        payment_pts=_payment_component(metrics),
        fast_mover_pts=_fast_mover_component(org, metrics, now),
    )
