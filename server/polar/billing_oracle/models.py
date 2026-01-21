"""
Canonical domain models for the Billing Oracle.

These are pure data models representing expected billing artifacts.
All computations are deterministic and based solely on input state.

Key design choice: Stable IDs for actionable diffs.
Each expected line item gets a deterministic ID like:
    li:{subscription_id}:{period_start}:{price_id}:{proration_segment?}

This allows precise diffing:
- "missing line item" (not just "totals differ")
- "wrong amount on component X"
- "duplicate credit applied twice"
"""

from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from enum import StrEnum
from typing import Any
from uuid import UUID


class MismatchSeverity(StrEnum):
    """Severity levels for billing mismatches."""

    info = "info"  # Minor discrepancy, likely rounding
    warning = "warning"  # Unexpected but not critical
    error = "error"  # Significant mismatch requiring attention
    critical = "critical"  # Revenue-impacting, immediate action needed


class MismatchClassification(StrEnum):
    """Classification of billing mismatch types."""

    # Amount mismatches
    rounding_difference = "rounding_difference"  # Small rounding discrepancy
    amount_mismatch = "amount_mismatch"  # Significant amount difference
    tax_mismatch = "tax_mismatch"  # Tax calculation difference
    discount_mismatch = "discount_mismatch"  # Discount application issue

    # Structural mismatches
    missing_line_item = "missing_line_item"  # Expected item not found
    extra_line_item = "extra_line_item"  # Unexpected item present
    duplicate_line_item = "duplicate_line_item"  # Item appears multiple times

    # State mismatches
    status_mismatch = "status_mismatch"  # Order/subscription status differs
    period_mismatch = "period_mismatch"  # Billing period boundaries differ
    renewal_date_mismatch = "renewal_date_mismatch"  # Next renewal date differs

    # Event mismatches
    missing_billing_event = "missing_billing_event"  # Expected event not recorded
    unexpected_billing_event = "unexpected_billing_event"  # Event shouldn't exist
    event_order_mismatch = "event_order_mismatch"  # Events in wrong order

    # Payment mismatches
    payment_amount_mismatch = "payment_amount_mismatch"  # Payment differs from order
    refund_mismatch = "refund_mismatch"  # Refund amount discrepancy

    # Unknown
    unknown = "unknown"  # Unclassified mismatch


@dataclass(frozen=True)
class ExpectedLineItem:
    """
    Expected invoice line item computed by the Oracle.

    The stable_id is deterministic and allows precise diffing:
        li:{subscription_id}:{period_start}:{price_id}:{entry_type}
    """

    stable_id: str
    label: str
    amount: int  # In cents, always integer
    currency: str
    tax_amount: int
    proration: bool
    price_id: UUID | None
    period_start: datetime
    period_end: datetime
    entry_type: str  # cycle, proration, metered, seat_increase, seat_decrease

    # For metered items
    consumed_units: Decimal | None = None
    credited_units: int | None = None
    unit_amount: Decimal | None = None

    @classmethod
    def compute_stable_id(
        cls,
        subscription_id: UUID,
        period_start: datetime,
        price_id: UUID | None,
        entry_type: str,
        proration_segment: str | None = None,
    ) -> str:
        """Generate a deterministic stable ID for diffing."""
        base = f"li:{subscription_id}:{period_start.isoformat()}:{price_id}:{entry_type}"
        if proration_segment:
            base += f":{proration_segment}"
        return base


@dataclass(frozen=True)
class ExpectedOrder:
    """
    Expected order (invoice) computed by the Oracle.

    Contains all expected line items and computed totals.
    """

    stable_id: str  # o:{subscription_id}:{period_start}:{billing_reason}
    subscription_id: UUID
    customer_id: UUID
    product_id: UUID | None
    billing_reason: str
    currency: str

    # Computed totals
    subtotal_amount: int
    discount_amount: int
    tax_amount: int
    total_amount: int
    applied_balance_amount: int
    due_amount: int

    # Period info
    period_start: datetime
    period_end: datetime

    # Discount info
    discount_id: UUID | None = None
    discount_type: str | None = None  # fixed, percentage
    discount_basis_points: int | None = None  # For percentage discounts
    discount_fixed_amount: int | None = None  # For fixed discounts

    # Line items
    line_items: tuple[ExpectedLineItem, ...] = field(default_factory=tuple)

    @classmethod
    def compute_stable_id(
        cls,
        subscription_id: UUID,
        period_start: datetime,
        billing_reason: str,
    ) -> str:
        """Generate a deterministic stable ID for diffing."""
        return f"o:{subscription_id}:{period_start.isoformat()}:{billing_reason}"


@dataclass(frozen=True)
class ExpectedSubscriptionState:
    """Expected subscription state at a point in time."""

    subscription_id: UUID
    status: str
    current_period_start: datetime
    current_period_end: datetime | None
    next_renewal_at: datetime | None
    cancel_at_period_end: bool
    amount: int
    currency: str

    # Trial info
    trial_start: datetime | None = None
    trial_end: datetime | None = None

    # Discount info
    discount_id: UUID | None = None
    discount_applied_at: datetime | None = None


@dataclass(frozen=True)
class ActualLineItem:
    """Actual line item from production database."""

    order_item_id: UUID
    label: str
    amount: int
    currency: str
    tax_amount: int
    proration: bool
    price_id: UUID | None
    # Computed stable_id for matching
    stable_id: str | None = None


@dataclass(frozen=True)
class ActualOrder:
    """Actual order from production database."""

    order_id: UUID
    subscription_id: UUID | None
    customer_id: UUID
    product_id: UUID | None
    billing_reason: str
    currency: str
    status: str

    subtotal_amount: int
    discount_amount: int
    tax_amount: int
    total_amount: int
    applied_balance_amount: int

    period_start: datetime | None
    period_end: datetime | None

    discount_id: UUID | None = None

    line_items: tuple[ActualLineItem, ...] = field(default_factory=tuple)

    # For matching
    stable_id: str | None = None


@dataclass(frozen=True)
class OracleMismatch:
    """
    A single billing mismatch detected by the reconciler.

    Contains all context needed for debugging and alerting.
    """

    id: str  # Unique mismatch ID
    classification: MismatchClassification
    severity: MismatchSeverity
    message: str

    # Context
    subscription_id: UUID | None = None
    order_id: UUID | None = None
    line_item_stable_id: str | None = None

    # Values
    expected_value: Any = None
    actual_value: Any = None
    difference: Any = None  # For numeric mismatches

    # Timestamps
    detected_at: datetime = field(default_factory=lambda: datetime.now())
    period_start: datetime | None = None
    period_end: datetime | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "classification": self.classification.value,
            "severity": self.severity.value,
            "message": self.message,
            "subscription_id": str(self.subscription_id) if self.subscription_id else None,
            "order_id": str(self.order_id) if self.order_id else None,
            "line_item_stable_id": self.line_item_stable_id,
            "expected_value": self.expected_value,
            "actual_value": self.actual_value,
            "difference": self.difference,
            "detected_at": self.detected_at.isoformat(),
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
        }


@dataclass
class ReconciliationResult:
    """
    Result of a reconciliation run.

    Contains all detected mismatches and summary statistics.
    """

    run_id: str
    started_at: datetime
    completed_at: datetime | None = None

    # Scope
    subscription_id: UUID | None = None
    order_id: UUID | None = None
    period_start: datetime | None = None
    period_end: datetime | None = None

    # Results
    mismatches: list[OracleMismatch] = field(default_factory=list)
    orders_checked: int = 0
    line_items_checked: int = 0

    # Summary by severity
    critical_count: int = 0
    error_count: int = 0
    warning_count: int = 0
    info_count: int = 0

    @property
    def has_mismatches(self) -> bool:
        return len(self.mismatches) > 0

    @property
    def has_critical_mismatches(self) -> bool:
        return self.critical_count > 0

    @property
    def has_errors(self) -> bool:
        return self.error_count > 0 or self.critical_count > 0

    def add_mismatch(self, mismatch: OracleMismatch) -> None:
        """Add a mismatch and update counters."""
        self.mismatches.append(mismatch)
        match mismatch.severity:
            case MismatchSeverity.critical:
                self.critical_count += 1
            case MismatchSeverity.error:
                self.error_count += 1
            case MismatchSeverity.warning:
                self.warning_count += 1
            case MismatchSeverity.info:
                self.info_count += 1

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "run_id": self.run_id,
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "subscription_id": str(self.subscription_id) if self.subscription_id else None,
            "order_id": str(self.order_id) if self.order_id else None,
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "orders_checked": self.orders_checked,
            "line_items_checked": self.line_items_checked,
            "critical_count": self.critical_count,
            "error_count": self.error_count,
            "warning_count": self.warning_count,
            "info_count": self.info_count,
            "mismatches": [m.to_dict() for m in self.mismatches],
        }


# Tolerance thresholds for mismatch classification
ROUNDING_TOLERANCE_CENTS = 1  # 1 cent tolerance for rounding
SIGNIFICANT_AMOUNT_THRESHOLD_CENTS = 100  # $1.00 threshold for "significant"
