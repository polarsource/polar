"""
Billing Reconciler: Compare expected vs actual billing artifacts.

The Reconciler:
1. Fetches actual records from DB
2. Normalizes them into the same shape as expected
3. Diffs and classifies mismatches (rounding vs logic vs missing vs duplicate)

Classification helps prioritize:
- Rounding: Likely benign, monitor for patterns
- Logic: Bug in billing code or Oracle
- Missing: Event not recorded or not processed
- Duplicate: Event processed twice
"""

import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import cast
from uuid import UUID

import structlog

from polar.billing_entry.repository import BillingEntryRepository
from polar.kit.db.postgres import AsyncSession
from polar.models import BillingEntry, Order, OrderItem, Subscription
from polar.models.billing_entry import BillingEntryType
from polar.models.order import OrderBillingReasonInternal

from .models import (
    ActualLineItem,
    ActualOrder,
    ExpectedLineItem,
    ExpectedOrder,
    MismatchClassification,
    MismatchSeverity,
    OracleMismatch,
    ReconciliationResult,
    ROUNDING_TOLERANCE_CENTS,
    SIGNIFICANT_AMOUNT_THRESHOLD_CENTS,
)
from .oracle import BillingOracle
from .repository import BillingOracleRepository

log = structlog.get_logger(__name__)


class BillingReconciler:
    """
    Reconciler that compares expected vs actual billing artifacts.

    Usage:
        reconciler = BillingReconciler(session, oracle)
        result = await reconciler.reconcile_order(order_id)
        if result.has_critical_mismatches:
            # Alert!
    """

    def __init__(
        self,
        session: AsyncSession,
        oracle: BillingOracle | None = None,
    ):
        self.session = session
        self.oracle = oracle or BillingOracle()
        self.repository = BillingOracleRepository(session)

    async def reconcile_order(
        self,
        order_id: UUID,
    ) -> ReconciliationResult:
        """
        Reconcile a single order against Oracle expectations.

        Fetches the order and related data, simulates expected order,
        then compares and classifies any mismatches.
        """
        run_id = str(uuid.uuid4())
        started_at = datetime.now(UTC)

        result = ReconciliationResult(
            run_id=run_id,
            started_at=started_at,
            order_id=order_id,
        )

        # Fetch actual order
        actual = await self.repository.get_order_with_items(order_id)
        if actual is None:
            result.add_mismatch(
                OracleMismatch(
                    id=f"{run_id}:order_not_found",
                    classification=MismatchClassification.unknown,
                    severity=MismatchSeverity.error,
                    message=f"Order {order_id} not found in database",
                    order_id=order_id,
                )
            )
            result.completed_at = datetime.now(UTC)
            return result

        result.subscription_id = actual.subscription_id
        result.orders_checked = 1

        # If no subscription, can't simulate (one-time purchase)
        if actual.subscription_id is None:
            log.info("Order has no subscription, skipping Oracle simulation", order_id=order_id)
            result.completed_at = datetime.now(UTC)
            return result

        # Fetch subscription and billing entries
        subscription = await self.repository.get_subscription(actual.subscription_id)
        if subscription is None:
            result.add_mismatch(
                OracleMismatch(
                    id=f"{run_id}:subscription_not_found",
                    classification=MismatchClassification.unknown,
                    severity=MismatchSeverity.error,
                    message=f"Subscription {actual.subscription_id} not found",
                    subscription_id=actual.subscription_id,
                    order_id=order_id,
                )
            )
            result.completed_at = datetime.now(UTC)
            return result

        # Get billing entries for this order
        billing_entries = await self.repository.get_billing_entries_for_order(order_id)

        # Simulate expected order
        expected = self.oracle.simulate_subscription_cycle_order(
            subscription=subscription,
            billing_entries=billing_entries,
            billing_reason=actual.billing_reason,
        )

        # Compare and classify mismatches
        self._compare_order_totals(result, expected, actual)
        self._compare_line_items(result, expected, actual)

        # Check Oracle invariants
        if not self.oracle.check_conservation_invariant(expected):
            result.add_mismatch(
                OracleMismatch(
                    id=f"{run_id}:oracle_conservation_violated",
                    classification=MismatchClassification.unknown,
                    severity=MismatchSeverity.critical,
                    message="Oracle conservation invariant violated - this is a bug in the Oracle",
                    subscription_id=subscription.id,
                    order_id=order_id,
                )
            )

        result.completed_at = datetime.now(UTC)
        return result

    async def reconcile_subscription(
        self,
        subscription_id: UUID,
        period_start: datetime | None = None,
        period_end: datetime | None = None,
    ) -> ReconciliationResult:
        """
        Reconcile all orders for a subscription within a period.

        If period is not specified, reconciles all orders.
        """
        run_id = str(uuid.uuid4())
        started_at = datetime.now(UTC)

        result = ReconciliationResult(
            run_id=run_id,
            started_at=started_at,
            subscription_id=subscription_id,
            period_start=period_start,
            period_end=period_end,
        )

        # Get all orders for this subscription
        orders = await self.repository.get_orders_for_subscription(
            subscription_id, period_start, period_end
        )

        for order in orders:
            order_result = await self.reconcile_order(order.id)
            result.orders_checked += 1
            result.line_items_checked += order_result.line_items_checked

            # Merge mismatches
            for mismatch in order_result.mismatches:
                result.add_mismatch(mismatch)

        result.completed_at = datetime.now(UTC)
        return result

    async def reconcile_recent_orders(
        self,
        hours: int = 24,
        limit: int = 1000,
    ) -> ReconciliationResult:
        """
        Reconcile all orders created in the last N hours.

        This is the "nightly sweep" reconciliation mode.
        """
        run_id = str(uuid.uuid4())
        started_at = datetime.now(UTC)

        result = ReconciliationResult(
            run_id=run_id,
            started_at=started_at,
        )

        orders = await self.repository.get_recent_subscription_orders(hours, limit)

        for order in orders:
            order_result = await self.reconcile_order(order.id)
            result.orders_checked += 1
            result.line_items_checked += order_result.line_items_checked

            for mismatch in order_result.mismatches:
                result.add_mismatch(mismatch)

        result.completed_at = datetime.now(UTC)
        return result

    def _compare_order_totals(
        self,
        result: ReconciliationResult,
        expected: ExpectedOrder,
        actual: ActualOrder,
    ) -> None:
        """Compare order-level totals and detect mismatches."""
        run_id = result.run_id

        # Subtotal comparison
        if expected.subtotal_amount != actual.subtotal_amount:
            diff = actual.subtotal_amount - expected.subtotal_amount
            severity, classification = self._classify_amount_mismatch(diff)
            result.add_mismatch(
                OracleMismatch(
                    id=f"{run_id}:subtotal_mismatch",
                    classification=classification,
                    severity=severity,
                    message=f"Subtotal mismatch: expected {expected.subtotal_amount}, actual {actual.subtotal_amount}",
                    subscription_id=expected.subscription_id,
                    order_id=actual.order_id,
                    expected_value=expected.subtotal_amount,
                    actual_value=actual.subtotal_amount,
                    difference=diff,
                    period_start=expected.period_start,
                    period_end=expected.period_end,
                )
            )

        # Discount comparison
        if expected.discount_amount != actual.discount_amount:
            diff = actual.discount_amount - expected.discount_amount
            result.add_mismatch(
                OracleMismatch(
                    id=f"{run_id}:discount_mismatch",
                    classification=MismatchClassification.discount_mismatch,
                    severity=MismatchSeverity.warning if abs(diff) <= ROUNDING_TOLERANCE_CENTS else MismatchSeverity.error,
                    message=f"Discount mismatch: expected {expected.discount_amount}, actual {actual.discount_amount}",
                    subscription_id=expected.subscription_id,
                    order_id=actual.order_id,
                    expected_value=expected.discount_amount,
                    actual_value=actual.discount_amount,
                    difference=diff,
                )
            )

        # Tax comparison
        if expected.tax_amount != actual.tax_amount:
            diff = actual.tax_amount - expected.tax_amount
            result.add_mismatch(
                OracleMismatch(
                    id=f"{run_id}:tax_mismatch",
                    classification=MismatchClassification.tax_mismatch,
                    severity=MismatchSeverity.warning if abs(diff) <= ROUNDING_TOLERANCE_CENTS else MismatchSeverity.error,
                    message=f"Tax mismatch: expected {expected.tax_amount}, actual {actual.tax_amount}",
                    subscription_id=expected.subscription_id,
                    order_id=actual.order_id,
                    expected_value=expected.tax_amount,
                    actual_value=actual.tax_amount,
                    difference=diff,
                )
            )

        # Total comparison
        if expected.total_amount != actual.total_amount:
            diff = actual.total_amount - expected.total_amount
            severity, classification = self._classify_amount_mismatch(diff)
            result.add_mismatch(
                OracleMismatch(
                    id=f"{run_id}:total_mismatch",
                    classification=classification,
                    severity=severity,
                    message=f"Total mismatch: expected {expected.total_amount}, actual {actual.total_amount}",
                    subscription_id=expected.subscription_id,
                    order_id=actual.order_id,
                    expected_value=expected.total_amount,
                    actual_value=actual.total_amount,
                    difference=diff,
                )
            )

    def _compare_line_items(
        self,
        result: ReconciliationResult,
        expected: ExpectedOrder,
        actual: ActualOrder,
    ) -> None:
        """Compare line items between expected and actual orders."""
        run_id = result.run_id
        result.line_items_checked = len(expected.line_items) + len(actual.line_items)

        # Build lookup maps
        expected_by_price: dict[UUID | None, list[ExpectedLineItem]] = {}
        for item in expected.line_items:
            if item.price_id not in expected_by_price:
                expected_by_price[item.price_id] = []
            expected_by_price[item.price_id].append(item)

        actual_by_price: dict[UUID | None, list[ActualLineItem]] = {}
        for item in actual.line_items:
            if item.price_id not in actual_by_price:
                actual_by_price[item.price_id] = []
            actual_by_price[item.price_id].append(item)

        # Find missing line items (in expected but not in actual)
        for price_id, expected_items in expected_by_price.items():
            actual_items = actual_by_price.get(price_id, [])

            if len(actual_items) < len(expected_items):
                for i in range(len(actual_items), len(expected_items)):
                    expected_item = expected_items[i]
                    result.add_mismatch(
                        OracleMismatch(
                            id=f"{run_id}:missing_line_item:{expected_item.stable_id}",
                            classification=MismatchClassification.missing_line_item,
                            severity=MismatchSeverity.error,
                            message=f"Missing line item: {expected_item.label} ({expected_item.amount} cents)",
                            subscription_id=expected.subscription_id,
                            order_id=actual.order_id,
                            line_item_stable_id=expected_item.stable_id,
                            expected_value=expected_item.amount,
                            actual_value=None,
                        )
                    )

            # Compare matching items
            for i, expected_item in enumerate(expected_items[:len(actual_items)]):
                actual_item = actual_items[i]
                self._compare_single_line_item(
                    result, run_id, expected, actual.order_id, expected_item, actual_item
                )

        # Find extra line items (in actual but not in expected)
        for price_id, actual_items in actual_by_price.items():
            expected_items = expected_by_price.get(price_id, [])

            if len(actual_items) > len(expected_items):
                for i in range(len(expected_items), len(actual_items)):
                    actual_item = actual_items[i]
                    result.add_mismatch(
                        OracleMismatch(
                            id=f"{run_id}:extra_line_item:{actual_item.order_item_id}",
                            classification=MismatchClassification.extra_line_item,
                            severity=MismatchSeverity.warning,
                            message=f"Unexpected line item: {actual_item.label} ({actual_item.amount} cents)",
                            subscription_id=expected.subscription_id,
                            order_id=actual.order_id,
                            expected_value=None,
                            actual_value=actual_item.amount,
                        )
                    )

    def _compare_single_line_item(
        self,
        result: ReconciliationResult,
        run_id: str,
        expected_order: ExpectedOrder,
        order_id: UUID,
        expected: ExpectedLineItem,
        actual: ActualLineItem,
    ) -> None:
        """Compare a single line item pair."""
        if expected.amount != actual.amount:
            diff = actual.amount - expected.amount
            severity, classification = self._classify_amount_mismatch(diff)
            result.add_mismatch(
                OracleMismatch(
                    id=f"{run_id}:line_item_amount:{expected.stable_id}",
                    classification=classification,
                    severity=severity,
                    message=f"Line item amount mismatch for '{expected.label}': expected {expected.amount}, actual {actual.amount}",
                    subscription_id=expected_order.subscription_id,
                    order_id=order_id,
                    line_item_stable_id=expected.stable_id,
                    expected_value=expected.amount,
                    actual_value=actual.amount,
                    difference=diff,
                )
            )

        if expected.proration != actual.proration:
            result.add_mismatch(
                OracleMismatch(
                    id=f"{run_id}:line_item_proration:{expected.stable_id}",
                    classification=MismatchClassification.unknown,
                    severity=MismatchSeverity.warning,
                    message=f"Proration flag mismatch for '{expected.label}': expected {expected.proration}, actual {actual.proration}",
                    subscription_id=expected_order.subscription_id,
                    order_id=order_id,
                    line_item_stable_id=expected.stable_id,
                    expected_value=expected.proration,
                    actual_value=actual.proration,
                )
            )

    def _classify_amount_mismatch(
        self,
        difference: int,
    ) -> tuple[MismatchSeverity, MismatchClassification]:
        """Classify an amount mismatch based on magnitude."""
        abs_diff = abs(difference)

        if abs_diff == 0:
            # No mismatch
            return MismatchSeverity.info, MismatchClassification.rounding_difference

        if abs_diff <= ROUNDING_TOLERANCE_CENTS:
            # Likely rounding
            return MismatchSeverity.info, MismatchClassification.rounding_difference

        if abs_diff <= SIGNIFICANT_AMOUNT_THRESHOLD_CENTS:
            # Small but not rounding
            return MismatchSeverity.warning, MismatchClassification.amount_mismatch

        # Significant mismatch
        return MismatchSeverity.error, MismatchClassification.amount_mismatch
