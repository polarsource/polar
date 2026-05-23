"""Tests for the per-context lane registry dispatch (Slice 7)."""

from __future__ import annotations

from polar.organization_review_agent.lanes import (
    HistoryLane,
    IdentityLane,
    PaymentsLane,
    PayoutAccountLane,
    ProductsLane,
    lanes_for_context,
)


class TestLanesForContext:
    def test_default_context_runs_every_lane(self) -> None:
        """SUBMISSION / THRESHOLD / MANUAL / SETUP_COMPLETE fall back
        to the legacy 'every lane' behaviour."""

        for ctx in ("submission", "threshold", "manual", "setup_complete"):
            names = {l.name for l in lanes_for_context(ctx)}
            assert names == {
                HistoryLane.name,
                IdentityLane.name,
                PayoutAccountLane.name,
                PaymentsLane.name,
                ProductsLane.name,
            }, f"context={ctx} returned {names}"

    def test_chargeback_risk_skips_irrelevant_lanes(self) -> None:
        names = {l.name for l in lanes_for_context("chargeback_risk")}
        assert names == {
            HistoryLane.name,
            PaymentsLane.name,
            PayoutAccountLane.name,
        }
        # Products / identity skipped — they don't move the
        # chargeback-risk needle in a useful way.
        assert IdentityLane.name not in names
        assert ProductsLane.name not in names

    def test_pattern_match_is_minimal(self) -> None:
        """Parent PATTERN_MATCH runs are decision-only — they don't
        need to re-fetch everything; the per-child runs do."""

        names = {l.name for l in lanes_for_context("pattern_match")}
        assert names == {HistoryLane.name}

    def test_appeal_includes_identity(self) -> None:
        names = {l.name for l in lanes_for_context("appeal")}
        assert IdentityLane.name in names
        assert HistoryLane.name in names
        # Payments skipped — appeal-time payment refresh is noise.
        assert PaymentsLane.name not in names
