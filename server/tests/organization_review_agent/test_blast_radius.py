"""Tests for the blast-radius two-person gate (Slice 11)."""

from __future__ import annotations

from datetime import datetime, timedelta, UTC
from uuid import UUID

from polar.models.organization_review_agent_run import (
    OrganizationReviewAgentRun,
)
from polar.organization_review_agent.blast_radius import (
    compute_blast_radius,
    requires_two_person,
)


def _make_run(
    *,
    gmv_cents: int = 0,
    payout_balance_cents: int = 0,
    org_created_at: datetime | None = None,
) -> OrganizationReviewAgentRun:
    """Build a run with synthetic lane facts for blast-radius scoring."""

    snapshot = {
        "findings": {
            "payments": {
                "name": "payments",
                "payload": {"total_amount_cents": gmv_cents},
            },
            "payout_account": {
                "name": "payout_account",
                "payload": {"balance_amount_cents": payout_balance_cents},
            },
        }
    }
    return OrganizationReviewAgentRun(
        organization_id=UUID(int=1),
        context="submission",
        triggered_by="shadow",
        state_snapshot=snapshot,
        org_snapshot=(
            {"created_at": org_created_at.isoformat()}
            if org_created_at
            else {}
        ),
    )


class TestComputeBlastRadius:
    def test_zero_facts_emits_zero_scores(self) -> None:
        run = _make_run()
        radius = compute_blast_radius(run)
        assert radius.gmv_at_stake_usd == 0
        assert radius.payout_balance_usd == 0
        # Missing created_at is treated as "old enough to breach" —
        # conservative path.
        assert radius.org_age_days is None
        assert radius.breached is True

    def test_high_gmv_breaches(self) -> None:
        run = _make_run(
            gmv_cents=1_500_000,  # $15k
            org_created_at=datetime.now(UTC),
        )
        radius = compute_blast_radius(run)
        assert radius.gmv_at_stake_usd == 15_000
        assert radius.breached is True
        assert any(
            "gmv_at_stake" in r for r in radius.breach_reasons
        )

    def test_old_org_breaches(self) -> None:
        run = _make_run(
            gmv_cents=0,
            org_created_at=datetime.now(UTC) - timedelta(days=120),
        )
        radius = compute_blast_radius(run)
        assert radius.org_age_days is not None
        assert radius.org_age_days >= 90
        assert radius.breached is True
        assert any("org_age" in r for r in radius.breach_reasons)

    def test_young_low_volume_does_not_breach(self) -> None:
        run = _make_run(
            gmv_cents=100_000,  # $1k
            payout_balance_cents=10_000,  # $100
            org_created_at=datetime.now(UTC) - timedelta(days=10),
        )
        radius = compute_blast_radius(run)
        assert radius.breached is False
        assert radius.breach_reasons == []


class TestRequiresTwoPerson:
    def test_approve_never_requires_two_person(self) -> None:
        run = _make_run(
            gmv_cents=10_000_000,  # $100k — would breach
            org_created_at=datetime.now(UTC) - timedelta(days=200),
        )
        required, reasons = requires_two_person(run, "approve")
        assert required is False
        assert reasons == []

    def test_deny_on_breach_requires_two_person(self) -> None:
        run = _make_run(
            gmv_cents=1_500_000,
            org_created_at=datetime.now(UTC) - timedelta(days=120),
        )
        required, reasons = requires_two_person(run, "deny")
        assert required is True
        assert len(reasons) >= 1

    def test_deny_on_low_radius_does_not_require_two_person(self) -> None:
        run = _make_run(
            gmv_cents=0,
            payout_balance_cents=0,
            org_created_at=datetime.now(UTC) - timedelta(days=5),
        )
        required, reasons = requires_two_person(run, "deny")
        assert required is False
        assert reasons == []
