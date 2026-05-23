"""Blast-radius two-person rule (Slice 11).

Computes a "blast radius" score from a run's lane facts + org
snapshot, and decides whether a commit requires a second-reviewer
confirmation before flipping ``organizations.status`` (once v2 is
promoted out of shadow).

Today this is a structural primitive: the score + the threshold are
exposed via :func:`requires_two_person` so the backoffice commit
flow can branch. The actual "second reviewer must click confirm"
gate lands as part of the Slice 11 part 2 commit-flow upgrade.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from polar.kit.utils import utc_now
from polar.models.organization_review_agent_run import (
    OrganizationReviewAgentRun,
)


# Thresholds the plan called out: $10k GMV, $5k payout balance, or
# 90d org age. Tuned conservatively — the gate's false-positive cost
# (an extra reviewer click) is much lower than its false-negative
# cost (a deny that loses meaningful merchant trust + revenue).
_GMV_AT_STAKE_USD_THRESHOLD = 10_000
_PAYOUT_BALANCE_USD_THRESHOLD = 5_000
_ORG_AGE_DAYS_THRESHOLD = 90


@dataclass(slots=True)
class BlastRadius:
    """Per-run blast-radius scoring.

    ``gmv_at_stake_usd`` / ``payout_balance_usd`` are denominated in
    whole USD (lane facts store cents; we coerce here so the
    threshold comparison stays legible). ``org_age_days`` is None for
    runs without an org created_at — the conservative path treats
    that as breaching the age threshold (a missing signal shouldn't
    silently downshift the gate).
    """

    gmv_at_stake_usd: float
    payout_balance_usd: float
    org_age_days: int | None

    @property
    def breached(self) -> bool:
        if self.gmv_at_stake_usd >= _GMV_AT_STAKE_USD_THRESHOLD:
            return True
        if self.payout_balance_usd >= _PAYOUT_BALANCE_USD_THRESHOLD:
            return True
        if self.org_age_days is None or self.org_age_days >= _ORG_AGE_DAYS_THRESHOLD:
            return True
        return False

    @property
    def breach_reasons(self) -> list[str]:
        reasons: list[str] = []
        if self.gmv_at_stake_usd >= _GMV_AT_STAKE_USD_THRESHOLD:
            reasons.append(
                f"gmv_at_stake ${self.gmv_at_stake_usd:,.0f} ≥ "
                f"${_GMV_AT_STAKE_USD_THRESHOLD:,}"
            )
        if self.payout_balance_usd >= _PAYOUT_BALANCE_USD_THRESHOLD:
            reasons.append(
                f"payout_balance ${self.payout_balance_usd:,.0f} ≥ "
                f"${_PAYOUT_BALANCE_USD_THRESHOLD:,}"
            )
        if self.org_age_days is None:
            reasons.append("org_age unknown")
        elif self.org_age_days >= _ORG_AGE_DAYS_THRESHOLD:
            reasons.append(
                f"org_age {self.org_age_days}d ≥ "
                f"{_ORG_AGE_DAYS_THRESHOLD}d"
            )
        return reasons


def compute_blast_radius(
    run: OrganizationReviewAgentRun,
) -> BlastRadius:
    """Derive blast-radius signals from the run's persisted state.

    Reads only the run row (org_snapshot + state_snapshot lane facts)
    so the helper is pure / DB-free and the value can be displayed
    inline in the backoffice commit form without a second query.
    """

    state_snapshot: dict[str, Any] = run.state_snapshot or {}
    lanes: dict[str, Any] = (
        state_snapshot.get("findings", {}) if state_snapshot else {}
    )
    payments_facts = (lanes.get("payments") or {}).get("payload", {})
    payout_facts = (lanes.get("payout_account") or {}).get("payload", {})

    gmv_cents = payments_facts.get("total_amount_cents") or 0
    payout_balance_cents = payout_facts.get("balance_amount_cents") or 0

    org_snapshot: dict[str, Any] = run.org_snapshot or {}
    org_created_at_raw = org_snapshot.get("created_at")
    org_age_days: int | None
    if org_created_at_raw:
        try:
            org_created_at = datetime.fromisoformat(
                org_created_at_raw.replace("Z", "+00:00")
                if isinstance(org_created_at_raw, str)
                else org_created_at_raw
            )
            org_age_days = max(
                0, (utc_now() - org_created_at).days
            )
        except (ValueError, TypeError):
            org_age_days = None
    else:
        org_age_days = None

    return BlastRadius(
        gmv_at_stake_usd=gmv_cents / 100,
        payout_balance_usd=payout_balance_cents / 100,
        org_age_days=org_age_days,
    )


def requires_two_person(
    run: OrganizationReviewAgentRun,
    committed_verdict: str,
) -> tuple[bool, list[str]]:
    """Whether the commit requires a second-reviewer confirmation.

    Returns ``(required, reasons)``. DENY commits trigger the check
    against blast-radius thresholds; APPROVE commits are always
    single-reviewer regardless of blast radius. Unconditional
    two-person gates (block / offboard / deny-appeal) live in the
    legacy organization_service path, not here.
    """

    if committed_verdict != "deny":
        return False, []
    radius = compute_blast_radius(run)
    if not radius.breached:
        return False, []
    return True, radius.breach_reasons


__all__ = [
    "BlastRadius",
    "compute_blast_radius",
    "requires_two_person",
]
