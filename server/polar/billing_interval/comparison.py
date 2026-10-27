"""Comparison value types, including the future orders.metered_comparison payload."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from polar.reducer.types import ObservedUsage, UsageIncompleteReason, WindowUsage

from .types import (
    LegacyUsage,
    MeteredSettlement,
    PricedUsageWindow,
    SettlementPlan,
    UsageDiagnostic,
)


@dataclass(frozen=True)
class ComparisonPolicy:
    name: Literal["historical_intervals"] = "historical_intervals"
    version: int = 1
    rel_tol: float = 1e-9
    abs_tol: float = 0.0


@dataclass(frozen=True)
class OrderComparisonCapture:
    """Durable input; capture validates request.order_id against the owning order."""

    request: MeteredSettlement
    policy: ComparisonPolicy
    sequence: int
    kind: Literal["order"] = "order"


@dataclass(frozen=True)
class PreviewComparisonCapture:
    """Transient input; capture validates that the settlement has no order."""

    request: MeteredSettlement
    policy: ComparisonPolicy
    kind: Literal["preview"] = "preview"


@dataclass(frozen=True)
class DiagnosticComparisonCapture:
    request: UsageDiagnostic
    policy: ComparisonPolicy
    kind: Literal["diagnostic"] = "diagnostic"


type ComparisonCapture = (
    OrderComparisonCapture | PreviewComparisonCapture | DiagnosticComparisonCapture
)


@dataclass(frozen=True)
class DeferredUsage:
    usage: WindowUsage
    reason: Literal["awaiting_resubscription"] = "awaiting_resubscription"


@dataclass(frozen=True)
class QuantityComparison:
    """A legacy-rule projection with an equivalent aggregation scope."""

    legacy: LegacyUsage
    candidate_quantity: Decimal
    difference: Decimal
    matches: bool


@dataclass(frozen=True)
class UsageDifference:
    kind: Literal[
        "new_only", "legacy_only", "ownership", "price", "policy", "population"
    ]
    legacy_usage: tuple[LegacyUsage, ...]
    candidate_windows: tuple[PricedUsageWindow, ...]


@dataclass(frozen=True)
class EvaluatedComparison:
    quantities: tuple[QuantityComparison, ...]
    differences: tuple[UsageDifference, ...]
    kind: Literal["legacy_evaluated"] = "legacy_evaluated"


@dataclass(frozen=True)
class DiagnosticComparison:
    kind: Literal["legacy_not_evaluated"] = "legacy_not_evaluated"


@dataclass(frozen=True)
class PendingComparison:
    capture: ComparisonCapture
    status: Literal["pending"] = "pending"


type ComparisonBlockedReason = (
    UsageIncompleteReason
    | Literal[
        "preceding_comparison_pending",
        "scheduled_transition_pending",
        "observation_failed",
    ]
)


@dataclass(frozen=True)
class BlockedComparison:
    capture: ComparisonCapture
    reason: ComparisonBlockedReason
    plan: SettlementPlan | None
    status: Literal["blocked"] = "blocked"


@dataclass(frozen=True)
class CompleteComparison:
    capture: OrderComparisonCapture | PreviewComparisonCapture
    plan: SettlementPlan
    observation: ObservedUsage
    result: EvaluatedComparison
    deferred_usage: tuple[DeferredUsage, ...]
    status: Literal["complete"] = "complete"


@dataclass(frozen=True)
class CompleteDiagnosticComparison:
    capture: DiagnosticComparisonCapture
    plan: SettlementPlan
    observation: ObservedUsage
    result: DiagnosticComparison
    deferred_usage: tuple[DeferredUsage, ...]
    status: Literal["complete"] = "complete"


type BillingComparison = (
    PendingComparison
    | BlockedComparison
    | CompleteComparison
    | CompleteDiagnosticComparison
)
