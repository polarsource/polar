"""Lane registry.

A lane is a focused investigator the Investigate node fans out to in
parallel. The registry is a tiny module-level dict so adding a lane is
a single import + dict update.

Per-context lane selection (``lanes_for_run(context)``) lives here so
Slice 7's multi-context dispatch has one place to attach context-
specific gates. For Slice 0/1 every context runs every lane that's
enabled at the per-lane level.
"""

from __future__ import annotations

from .base import Lane, LaneRunContext, LaneRunResult, assert_known_lane_name
from .history import HistoryLane, history_lane
from .payments import PaymentsLane, payments_lane
from .payout_account import PayoutAccountLane, payout_account_lane

_REGISTRY: dict[str, Lane] = {
    HistoryLane.name: history_lane,
    PayoutAccountLane.name: payout_account_lane,
    PaymentsLane.name: payments_lane,
}


def all_lanes() -> dict[str, Lane]:
    """Snapshot of every registered lane, keyed by name."""

    return dict(_REGISTRY)


def lanes_for_context(context: str) -> list[Lane]:
    """Return lanes to fan out to for a given review context.

    Slice 7 specialises this per-context (CHARGEBACK_RISK skips
    website + identity; APPEAL adds the appeal_context lane; etc.).
    Today every lane runs for every context — the per-lane
    :meth:`Lane.is_enabled` predicate handles cheap skips.
    """

    return list(_REGISTRY.values())


def get_lane(name: str) -> Lane:
    """Look up a lane by name, asserting it exists for tests + routing."""

    assert_known_lane_name(name, registered=set(_REGISTRY))
    return _REGISTRY[name]


__all__ = [
    "HistoryLane",
    "Lane",
    "LaneRunContext",
    "LaneRunResult",
    "PaymentsLane",
    "PayoutAccountLane",
    "all_lanes",
    "get_lane",
    "history_lane",
    "lanes_for_context",
    "payments_lane",
    "payout_account_lane",
]
