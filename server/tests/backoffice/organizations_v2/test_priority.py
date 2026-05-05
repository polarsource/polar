"""Pure unit tests for the Review queue priority module.

These tests build synthetic Organization objects in memory and pass
``PaymentMetrics`` directly — no DB session, no JSONB, no fixtures.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Any
from unittest.mock import MagicMock
from uuid import uuid4

import pytest

from polar.backoffice.organizations_v2.priority import (
    AGING_DAILY_PTS,
    AGING_MAX_PTS,
    compute,
)
from polar.organization_review.schemas import PaymentMetrics


def _metrics(
    *,
    total_payments: int = 0,
    succeeded_payments: int = 0,
    refund_count: int = 0,
    dispute_count: int = 0,
    total_amount_cents: int = 0,
) -> PaymentMetrics:
    return PaymentMetrics(
        total_payments=total_payments,
        succeeded_payments=succeeded_payments,
        total_amount_cents=total_amount_cents,
        refund_count=refund_count,
        refund_amount_cents=0,
        dispute_count=dispute_count,
        dispute_amount_cents=0,
    )


NOW = datetime(2026, 5, 4, 12, 0, 0, tzinfo=UTC)


def _org(
    *,
    created_days_ago: int = 100,
    days_in_status: int = 0,
    total_balance: int | None = 0,
) -> Any:
    """Build a fake Organization with just the timestamps the formula reads.

    Timestamps are anchored at module-level ``NOW`` so the test's ``now=NOW``
    parameter to ``compute`` produces an exact aging value.
    """
    org = MagicMock()
    org.id = uuid4()
    org.created_at = NOW - timedelta(days=created_days_ago)
    org.status_updated_at = NOW - timedelta(days=days_in_status)
    org.total_balance = total_balance
    return org


class TestAgingComponent:
    def test_linear_ramp(self) -> None:
        s = compute(_org(days_in_status=4), now=NOW)
        assert s.aging_pts == pytest.approx(4 * AGING_DAILY_PTS)

    def test_outranks_single_signal_at_ten_days(self) -> None:
        # Aging at 10d = 25 — equal to any single non-aging component cap,
        # so a 10d-stale org ties (and beyond, beats) one with HIGH risk only.
        s = compute(_org(days_in_status=10), now=NOW)
        assert s.aging_pts == pytest.approx(25.0)

    def test_caps_at_max_after_long_wait(self) -> None:
        s = compute(_org(days_in_status=100), now=NOW)
        assert s.aging_pts == pytest.approx(AGING_MAX_PTS)

    def test_aging_dominates_combined_signals_when_truly_stale(self) -> None:
        # 20d in status: aging=50 alone outranks any fresh org's risk(25)+payment(25).
        aged = compute(_org(days_in_status=20), now=NOW)
        fresh = compute(
            _org(days_in_status=2),
            metrics=_metrics(
                total_payments=100, succeeded_payments=100, dispute_count=5
            ),
            risk_score=100.0,
            now=NOW,
        )
        assert aged.priority > fresh.priority


class TestRiskComponent:
    def test_low_risk_no_points(self) -> None:
        # LOW-risk orgs are typically threshold re-reviews of already-approved
        # merchants — the agent confirming "still fine" shouldn't add priority.
        s = compute(_org(), risk_score=15.0, now=NOW)
        assert s.risk_pts == 0.0

    def test_medium_risk(self) -> None:
        s = compute(_org(), risk_score=50.0, now=NOW)
        assert s.risk_pts == pytest.approx(12.5)

    def test_high_risk(self) -> None:
        s = compute(_org(), risk_score=85.0, now=NOW)
        assert s.risk_pts == pytest.approx(25.0 * 0.85)

    def test_no_risk_score_no_points(self) -> None:
        s = compute(_org(), now=NOW)
        assert s.risk_pts == 0.0


class TestPaymentHealthComponent:
    def test_low_auth_below_sample_size_does_not_fire(self) -> None:
        s = compute(
            _org(),
            metrics=_metrics(total_payments=4, succeeded_payments=1),
            now=NOW,
        )
        assert s.payment_pts == 0.0

    def test_low_auth_fires(self) -> None:
        s = compute(
            _org(),
            metrics=_metrics(total_payments=10, succeeded_payments=5),
            now=NOW,
        )
        assert s.payment_pts == pytest.approx(10.0)

    def test_high_refund_fires(self) -> None:
        # 15% refund, 100% auth
        s = compute(
            _org(),
            metrics=_metrics(total_payments=20, succeeded_payments=20, refund_count=3),
            now=NOW,
        )
        assert s.payment_pts == pytest.approx(10.0)

    def test_dispute_fires_strongly(self) -> None:
        s = compute(
            _org(),
            metrics=_metrics(
                total_payments=100, succeeded_payments=100, dispute_count=2
            ),
            now=NOW,
        )
        assert s.payment_pts == pytest.approx(15.0)

    def test_payment_component_caps_at_25(self) -> None:
        s = compute(
            _org(),
            metrics=_metrics(
                total_payments=100,
                succeeded_payments=20,  # 20% auth (10pts)
                refund_count=20,  # 20% refund (10pts)
                dispute_count=5,  # disputes (15pts) → raw 35, capped at 25
            ),
            now=NOW,
        )
        assert s.payment_pts == pytest.approx(25.0)


class TestFastMoverComponent:
    def test_old_org_does_not_fire(self) -> None:
        s = compute(
            _org(created_days_ago=120),
            metrics=_metrics(total_amount_cents=1_000_000, total_payments=100),
            now=NOW,
        )
        assert s.fast_mover_pts == 0.0

    def test_new_org_below_threshold_does_not_fire(self) -> None:
        s = compute(
            _org(created_days_ago=10),
            metrics=_metrics(total_amount_cents=50_000, total_payments=5),
            now=NOW,
        )
        assert s.fast_mover_pts == 0.0

    def test_new_org_log_ramp(self) -> None:
        # $3k → ~11.9 pts (mid-ramp)
        s3k = compute(
            _org(created_days_ago=10),
            metrics=_metrics(total_amount_cents=300_000, total_payments=20),
            now=NOW,
        )
        assert s3k.fast_mover_pts == pytest.approx(11.9, abs=0.2)
        # $10k → 25 pts (cap)
        s10k = compute(
            _org(created_days_ago=10),
            metrics=_metrics(total_amount_cents=1_000_000, total_payments=20),
            now=NOW,
        )
        assert s10k.fast_mover_pts == pytest.approx(25.0)

    def test_total_balance_overrides_stale_agent_metrics(self) -> None:
        # Agent snapshot is stale ($106) but the live balance shows $2,500 of
        # recent activity. Fast Mover should use the larger.
        s = compute(
            _org(created_days_ago=12, total_balance=250_000),
            metrics=_metrics(total_amount_cents=10_600, total_payments=3),
            now=NOW,
        )
        # log10(2500/1000) ≈ 0.40 → ~10 pts
        assert 9.0 < s.fast_mover_pts < 11.0

    def test_payment_count_threshold_fires_without_revenue(self) -> None:
        s = compute(
            _org(created_days_ago=10),
            metrics=_metrics(
                total_amount_cents=0, total_payments=30, succeeded_payments=30
            ),
            now=NOW,
        )
        # Threshold met by payment count alone; ramp pinned at 0 (revenue floor)
        assert s.fast_mover_pts == pytest.approx(0.0, abs=0.5)


class TestPriorityComposite:
    def test_zero_signals(self) -> None:
        s = compute(_org(days_in_status=0, created_days_ago=200), now=NOW)
        assert s.priority == 0.0

    def test_priority_is_sum_of_components(self) -> None:
        s = compute(
            _org(days_in_status=14, created_days_ago=200),
            metrics=_metrics(total_payments=10, succeeded_payments=5),  # 50% auth
            risk_score=85.0,
            now=NOW,
        )
        # aging 14d * 2.5 (35) + risk 85% (21.25) + payment auth (10) + no fast
        assert s.priority == pytest.approx(66.25, abs=0.1)

    def test_max_priority_bounded(self) -> None:
        s = compute(
            _org(days_in_status=30, created_days_ago=10),
            metrics=_metrics(
                total_payments=100,
                succeeded_payments=10,
                refund_count=30,
                dispute_count=5,
                total_amount_cents=100_000_000,  # $1M, hits log ramp cap
            ),
            risk_score=100.0,
            now=NOW,
        )
        # aging max (50) + risk (25) + payment cap (25) + fast cap (25) = 125
        assert s.priority <= 125.0
