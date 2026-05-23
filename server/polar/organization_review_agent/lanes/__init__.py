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
from .categorisation import CategorisationLane, categorisation_lane
from .history import HistoryLane, history_lane
from .identity import IdentityLane, identity_lane
from .payments import PaymentsLane, payments_lane
from .payout_account import PayoutAccountLane, payout_account_lane
from .products import ProductsLane, products_lane

_REGISTRY: dict[str, Lane] = {
    HistoryLane.name: history_lane,
    IdentityLane.name: identity_lane,
    PayoutAccountLane.name: payout_account_lane,
    PaymentsLane.name: payments_lane,
    ProductsLane.name: products_lane,
    CategorisationLane.name: categorisation_lane,
}


# Slice 7: per-context lane filters. Each entry is a set of lane names
# enabled for that context; lanes not in the set skip entirely. An
# absent context falls back to "every lane" (legacy SUBMISSION
# behaviour). is_enabled() on the lane is still consulted afterward —
# this is the coarse-grained filter; per-lane runtime predicates fine-
# tune.
_CONTEXT_LANE_GATES: dict[str, frozenset[str]] = {
    "chargeback_risk": frozenset(
        {"history", "payments", "payout_account"}
    ),
    "payout_review": frozenset(
        {"history", "payout_account", "payments", "identity"}
    ),
    "appeal": frozenset(
        {"history", "identity", "payout_account", "products"}
    ),
    "pattern_match": frozenset({"history"}),  # parent-only minimal pass
}


def all_lanes() -> dict[str, Lane]:
    """Snapshot of every registered lane, keyed by name."""

    return dict(_REGISTRY)


def lanes_for_context(context: str) -> list[Lane]:
    """Return lanes to fan out to for a given review context.

    Coarse-grained dispatch: contexts in ``_CONTEXT_LANE_GATES`` skip
    lanes not in their set. Contexts without an entry (SUBMISSION,
    THRESHOLD, MANUAL, SETUP_COMPLETE) get every lane. Per-lane
    :meth:`Lane.is_enabled` predicates still apply afterward for fine-
    grained skips that depend on runtime state.
    """

    gate = _CONTEXT_LANE_GATES.get(context)
    if gate is None:
        return list(_REGISTRY.values())
    return [lane for name, lane in _REGISTRY.items() if name in gate]


def get_lane(name: str) -> Lane:
    """Look up a lane by name, asserting it exists for tests + routing."""

    assert_known_lane_name(name, registered=set(_REGISTRY))
    return _REGISTRY[name]


__all__ = [
    "CategorisationLane",
    "HistoryLane",
    "IdentityLane",
    "Lane",
    "LaneRunContext",
    "LaneRunResult",
    "PaymentsLane",
    "PayoutAccountLane",
    "ProductsLane",
    "all_lanes",
    "categorisation_lane",
    "get_lane",
    "history_lane",
    "identity_lane",
    "lanes_for_context",
    "payments_lane",
    "payout_account_lane",
    "products_lane",
]
