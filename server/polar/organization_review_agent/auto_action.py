"""Outcome-anchored auto-action scaffolding (Slice 6).

A rule registers an :class:`AutoActionRule` with a predicate over a
v2 run and (when eligible) a target action. Before a rule may go
live, it passes the retroactive-outcome gate via
:func:`evaluate_retroactive`: matched historical runs' 60d
post-decision outcomes (chargeback / refund / offboard / complaint)
must stay within tolerance of the matched-but-not-triggered cohort.

This commit ships the substrate:

* :class:`AutoActionRule` dataclass with predicate + action + caps.
* :class:`RuleRolloutState` (draft → shadow → live → paused).
* :func:`evaluate_retroactive` skeleton returning an
  :class:`OutcomeReport` over a historical cohort.

Production rules + the eval-data integration (joining downstream
:class:`Payment` / :class:`Refund` / :class:`Dispute` / Plain
complaints) land in Slice 6 part 2. Slice 9's pattern_match opening
already uses a similar substrate; we keep them parallel until both
mature.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import StrEnum

from polar.kit.utils import utc_now
from polar.models.organization_review_agent_run import (
    OrganizationReviewAgentRun,
)


class RuleAction(StrEnum):
    """What a triggered rule does."""

    AUTO_APPROVE = "auto_approve"
    AUTO_CLOSE_APPROVE = "auto_close_approve"
    ROUTE_TO_QUEUE = "route_to_queue"


# Block / offboard / deny-appeal are NEVER auto. Hard exclusion in
# the rule constructor enforces this — the plan calls this out
# explicitly and we keep it as a code-level invariant.
_FORBIDDEN_ACTIONS: frozenset[str] = frozenset(
    {"auto_deny", "auto_block", "auto_offboard", "auto_deny_appeal"}
)


class RuleRolloutState(StrEnum):
    """Lifecycle of an auto-action rule."""

    DRAFT = "draft"
    """Author-edited; not evaluating any traffic."""

    SHADOW = "shadow"
    """Logs would-have-fired decisions on live traffic, takes no
    action. Required ≥7d before promotion to live."""

    LIVE = "live"
    """Actively triggers on matching runs (within daily caps)."""

    PAUSED = "paused"
    """Frozen by σ-anomaly auto-disable or operator action."""


@dataclass(slots=True)
class AutoActionRule:
    """A single auto-action rule.

    The predicate is a pure function over a v2 run: returns True iff
    the rule should fire. Predicates use only data from the run (its
    final_report, raised_signals, lane facts, org_snapshot,
    triggered_by) — no live DB queries — so retroactive evaluation
    over historical runs has the same semantics as live triggering.
    """

    id: str  # stable identifier, e.g. "R-1"
    description: str
    predicate: Callable[[OrganizationReviewAgentRun], bool]
    action: RuleAction
    rollout_state: RuleRolloutState = RuleRolloutState.DRAFT
    daily_cap: int = 50
    """Max auto-actions per day; the rule engine pauses on cap-hit."""

    def __post_init__(self) -> None:
        if self.action.value in _FORBIDDEN_ACTIONS:
            raise ValueError(
                f"Action {self.action.value!r} is permanently excluded "
                "from the auto-action engine (block / offboard / "
                "deny-appeal always require a human decision)."
            )


@dataclass(slots=True)
class OutcomeMetric:
    """One post-decision outcome over a cohort.

    All four are rates per matched run, computed over a 60d forward
    window from the run's ``completed_at``. The retroactive gate
    requires all four to stay within tolerance of the cohort that
    matched but didn't trigger the rule.
    """

    chargeback_rate: float
    refund_rate: float
    offboard_rate: float
    complaint_rate: float


@dataclass(slots=True)
class OutcomeReport:
    """Result of :func:`evaluate_retroactive`."""

    rule_id: str
    window_start: datetime
    window_end: datetime
    matched_cohort_size: int
    matched_metrics: OutcomeMetric
    control_cohort_size: int
    control_metrics: OutcomeMetric
    psi: float
    """PSI on contributing kinds/facets over the rolling 30d vs the
    window. Promotion gate requires < 0.2."""

    promotion_eligible: bool
    reasons: list[str] = field(default_factory=list)


def evaluate_retroactive(
    rule: AutoActionRule,
    runs: Sequence[OrganizationReviewAgentRun],
    *,
    tolerance_absolute: float = 0.02,
    tolerance_relative: float = 0.25,
    min_sample_size: int = 25,
    window_days: int = 60,
) -> OutcomeReport:
    """Score a rule against a historical cohort.

    Slice 6 part 1 ships the structural shape: cohort partitioning +
    sample-size guard + promotion-eligible flag derivation. The
    actual outcome computation (joining downstream Payment / Refund /
    Dispute / Plain-complaint events) is a TODO — current metrics
    are zero-filled. The flag fires only when both cohorts meet the
    sample-size floor.

    The caller passes ``runs`` already-filtered to the relevant
    window so this helper stays pure / database-free.
    """

    now = utc_now()
    window_start = now - timedelta(days=window_days)

    matched: list[OrganizationReviewAgentRun] = []
    control: list[OrganizationReviewAgentRun] = []
    for run in runs:
        if run.completed_at is None or run.completed_at < window_start:
            continue
        if rule.predicate(run):
            matched.append(run)
        else:
            control.append(run)

    # TODO Slice 6 part 2: join Payment / Refund / Dispute / Plain
    # complaints over the 60d forward window for each cohort.
    matched_metrics = OutcomeMetric(0.0, 0.0, 0.0, 0.0)
    control_metrics = OutcomeMetric(0.0, 0.0, 0.0, 0.0)
    psi = 0.0  # TODO compute over contributing kinds/facets.

    reasons: list[str] = []
    eligible = True
    if len(matched) < min_sample_size:
        eligible = False
        reasons.append(
            f"matched cohort size {len(matched)} below floor "
            f"{min_sample_size}"
        )
    if len(control) < min_sample_size:
        eligible = False
        reasons.append(
            f"control cohort size {len(control)} below floor "
            f"{min_sample_size}"
        )
    if psi >= 0.2:
        eligible = False
        reasons.append(f"PSI {psi:.3f} ≥ 0.2 threshold")

    # Per-metric tolerance check would go here once metrics are real.
    for label, m, c in (
        ("chargeback", matched_metrics.chargeback_rate, control_metrics.chargeback_rate),
        ("refund", matched_metrics.refund_rate, control_metrics.refund_rate),
        ("offboard", matched_metrics.offboard_rate, control_metrics.offboard_rate),
        ("complaint", matched_metrics.complaint_rate, control_metrics.complaint_rate),
    ):
        absolute = abs(m - c)
        if absolute > tolerance_absolute:
            eligible = False
            reasons.append(
                f"{label} absolute delta {absolute:.3f} > "
                f"tolerance {tolerance_absolute}"
            )
        relative = (absolute / c) if c > 0 else 0.0
        if relative > tolerance_relative:
            eligible = False
            reasons.append(
                f"{label} relative delta {relative:.2%} > "
                f"tolerance {tolerance_relative:.0%}"
            )

    return OutcomeReport(
        rule_id=rule.id,
        window_start=window_start,
        window_end=now,
        matched_cohort_size=len(matched),
        matched_metrics=matched_metrics,
        control_cohort_size=len(control),
        control_metrics=control_metrics,
        psi=psi,
        promotion_eligible=eligible,
        reasons=reasons,
    )


# ---------------------------------------------------------------------------
# A first concrete rule, kept in DRAFT until Slice 6 part 2 lands the
# outcome integration + the routing rule UI lets a lead promote it.
# ---------------------------------------------------------------------------


def _r1_clean_approve(run: OrganizationReviewAgentRun) -> bool:
    """Eligible when the run terminated APPROVE with no signals AND no
    prior denials reflected in the org snapshot. Conservative shape so
    the historical evaluation has a real chance of passing the
    promotion gate.
    """

    if run.final_report is None:
        return False
    if run.final_report.get("verdict") != "approve":
        return False
    decisive = run.final_report.get("decisive_signal_kinds") or []
    if decisive:
        return False
    snapshot = run.org_snapshot or {}
    # Rough indicators that this is a brand-new org with no history.
    # Slice 6 part 2 reads the actual signal_history table here.
    return snapshot.get("status") in (None, "review", "created")


R1_CLEAN_APPROVE = AutoActionRule(
    id="R-1",
    description=(
        "Auto-close-approve runs that terminated APPROVE with zero "
        "decisive signals and no prior history concerns. Kept in DRAFT "
        "until Slice 6 part 2 lands the outcome eval + ≥7d shadow gate."
    ),
    predicate=_r1_clean_approve,
    action=RuleAction.AUTO_CLOSE_APPROVE,
    rollout_state=RuleRolloutState.DRAFT,
    daily_cap=50,
)


REGISTRY: dict[str, AutoActionRule] = {R1_CLEAN_APPROVE.id: R1_CLEAN_APPROVE}


__all__ = [
    "AutoActionRule",
    "OutcomeMetric",
    "OutcomeReport",
    "REGISTRY",
    "R1_CLEAN_APPROVE",
    "RuleAction",
    "RuleRolloutState",
    "evaluate_retroactive",
]
