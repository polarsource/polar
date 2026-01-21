"""
Tests for the Billing Reconciler.

Tests the comparison logic between expected and actual billing artifacts.
"""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from polar.billing_oracle.models import (
    ActualLineItem,
    ActualOrder,
    ExpectedLineItem,
    ExpectedOrder,
    MismatchClassification,
    MismatchSeverity,
    ReconciliationResult,
    ROUNDING_TOLERANCE_CENTS,
    SIGNIFICANT_AMOUNT_THRESHOLD_CENTS,
)
from polar.billing_oracle.reconciler import BillingReconciler


class TestMismatchClassification:
    """Test amount mismatch classification logic."""

    def test_zero_difference_is_info(self) -> None:
        """Zero difference is classified as info/rounding."""
        severity, classification = BillingReconciler._classify_amount_mismatch(
            BillingReconciler(None), 0  # type: ignore
        )
        assert severity == MismatchSeverity.info
        assert classification == MismatchClassification.rounding_difference

    def test_small_difference_is_rounding(self) -> None:
        """Small difference within tolerance is rounding."""
        severity, classification = BillingReconciler._classify_amount_mismatch(
            BillingReconciler(None), ROUNDING_TOLERANCE_CENTS  # type: ignore
        )
        assert severity == MismatchSeverity.info
        assert classification == MismatchClassification.rounding_difference

    def test_medium_difference_is_warning(self) -> None:
        """Medium difference is a warning."""
        diff = ROUNDING_TOLERANCE_CENTS + 10  # Above rounding, below significant
        severity, classification = BillingReconciler._classify_amount_mismatch(
            BillingReconciler(None), diff  # type: ignore
        )
        assert severity == MismatchSeverity.warning
        assert classification == MismatchClassification.amount_mismatch

    def test_large_difference_is_error(self) -> None:
        """Large difference is an error."""
        diff = SIGNIFICANT_AMOUNT_THRESHOLD_CENTS + 100
        severity, classification = BillingReconciler._classify_amount_mismatch(
            BillingReconciler(None), diff  # type: ignore
        )
        assert severity == MismatchSeverity.error
        assert classification == MismatchClassification.amount_mismatch

    def test_negative_difference_uses_absolute_value(self) -> None:
        """Negative differences use absolute value for classification."""
        diff = -(SIGNIFICANT_AMOUNT_THRESHOLD_CENTS + 100)
        severity, classification = BillingReconciler._classify_amount_mismatch(
            BillingReconciler(None), diff  # type: ignore
        )
        assert severity == MismatchSeverity.error
        assert classification == MismatchClassification.amount_mismatch


class TestLineItemComparison:
    """Test line item comparison logic."""

    def _make_expected_order(
        self,
        line_items: list[ExpectedLineItem],
    ) -> ExpectedOrder:
        """Helper to create an ExpectedOrder with line items."""
        subscription_id = uuid4()
        period_start = datetime.now(UTC)
        period_end = period_start + timedelta(days=30)

        subtotal = sum(item.amount for item in line_items)

        return ExpectedOrder(
            stable_id="test-order",
            subscription_id=subscription_id,
            customer_id=uuid4(),
            product_id=uuid4(),
            billing_reason="subscription_cycle",
            currency="usd",
            subtotal_amount=subtotal,
            discount_amount=0,
            tax_amount=0,
            total_amount=subtotal,
            applied_balance_amount=0,
            due_amount=subtotal,
            period_start=period_start,
            period_end=period_end,
            line_items=tuple(line_items),
        )

    def _make_actual_order(
        self,
        order_id: uuid4,
        subscription_id: uuid4,
        line_items: list[ActualLineItem],
    ) -> ActualOrder:
        """Helper to create an ActualOrder with line items."""
        subtotal = sum(item.amount for item in line_items)

        return ActualOrder(
            order_id=order_id,
            subscription_id=subscription_id,
            customer_id=uuid4(),
            product_id=uuid4(),
            billing_reason="subscription_cycle",
            currency="usd",
            status="paid",
            subtotal_amount=subtotal,
            discount_amount=0,
            tax_amount=0,
            total_amount=subtotal,
            applied_balance_amount=0,
            period_start=datetime.now(UTC),
            period_end=datetime.now(UTC) + timedelta(days=30),
            line_items=tuple(line_items),
        )

    def test_compare_matching_line_items(self) -> None:
        """Matching line items produce no mismatches."""
        price_id = uuid4()
        subscription_id = uuid4()
        order_id = uuid4()

        expected_items = [
            ExpectedLineItem(
                stable_id=f"li:{subscription_id}:cycle:{price_id}",
                label="Test Product",
                amount=10000,
                currency="usd",
                tax_amount=0,
                proration=False,
                price_id=price_id,
                period_start=datetime.now(UTC),
                period_end=datetime.now(UTC) + timedelta(days=30),
                entry_type="cycle",
            )
        ]

        actual_items = [
            ActualLineItem(
                order_item_id=uuid4(),
                label="Test Product",
                amount=10000,
                currency="usd",
                tax_amount=0,
                proration=False,
                price_id=price_id,
            )
        ]

        expected = self._make_expected_order(expected_items)
        actual = self._make_actual_order(order_id, subscription_id, actual_items)

        result = ReconciliationResult(
            run_id="test",
            started_at=datetime.now(UTC),
        )

        # Create a reconciler and call the comparison method
        reconciler = BillingReconciler(None)  # type: ignore
        reconciler._compare_line_items(result, expected, actual)

        # No amount mismatches (only checks structure/amount, not exact match)
        amount_mismatches = [
            m for m in result.mismatches
            if m.classification == MismatchClassification.amount_mismatch
        ]
        assert len(amount_mismatches) == 0

    def test_detect_missing_line_item(self) -> None:
        """Missing line item is detected."""
        price_id = uuid4()
        subscription_id = uuid4()
        order_id = uuid4()

        expected_items = [
            ExpectedLineItem(
                stable_id=f"li:{subscription_id}:cycle:{price_id}",
                label="Test Product",
                amount=10000,
                currency="usd",
                tax_amount=0,
                proration=False,
                price_id=price_id,
                period_start=datetime.now(UTC),
                period_end=datetime.now(UTC) + timedelta(days=30),
                entry_type="cycle",
            )
        ]

        actual_items: list[ActualLineItem] = []  # No actual items

        expected = self._make_expected_order(expected_items)
        actual = self._make_actual_order(order_id, subscription_id, actual_items)

        result = ReconciliationResult(
            run_id="test",
            started_at=datetime.now(UTC),
        )

        reconciler = BillingReconciler(None)  # type: ignore
        reconciler._compare_line_items(result, expected, actual)

        missing = [
            m for m in result.mismatches
            if m.classification == MismatchClassification.missing_line_item
        ]
        assert len(missing) == 1
        assert missing[0].expected_value == 10000

    def test_detect_extra_line_item(self) -> None:
        """Extra line item is detected."""
        price_id = uuid4()
        subscription_id = uuid4()
        order_id = uuid4()

        expected_items: list[ExpectedLineItem] = []  # No expected items

        actual_items = [
            ActualLineItem(
                order_item_id=uuid4(),
                label="Unexpected Product",
                amount=5000,
                currency="usd",
                tax_amount=0,
                proration=False,
                price_id=price_id,
            )
        ]

        expected = self._make_expected_order(expected_items)
        actual = self._make_actual_order(order_id, subscription_id, actual_items)

        result = ReconciliationResult(
            run_id="test",
            started_at=datetime.now(UTC),
        )

        reconciler = BillingReconciler(None)  # type: ignore
        reconciler._compare_line_items(result, expected, actual)

        extra = [
            m for m in result.mismatches
            if m.classification == MismatchClassification.extra_line_item
        ]
        assert len(extra) == 1
        assert extra[0].actual_value == 5000

    def test_detect_amount_mismatch(self) -> None:
        """Amount mismatch is detected."""
        price_id = uuid4()
        subscription_id = uuid4()
        order_id = uuid4()

        expected_items = [
            ExpectedLineItem(
                stable_id=f"li:{subscription_id}:cycle:{price_id}",
                label="Test Product",
                amount=10000,  # $100
                currency="usd",
                tax_amount=0,
                proration=False,
                price_id=price_id,
                period_start=datetime.now(UTC),
                period_end=datetime.now(UTC) + timedelta(days=30),
                entry_type="cycle",
            )
        ]

        actual_items = [
            ActualLineItem(
                order_item_id=uuid4(),
                label="Test Product",
                amount=9000,  # $90 - different!
                currency="usd",
                tax_amount=0,
                proration=False,
                price_id=price_id,
            )
        ]

        expected = self._make_expected_order(expected_items)
        actual = self._make_actual_order(order_id, subscription_id, actual_items)

        result = ReconciliationResult(
            run_id="test",
            started_at=datetime.now(UTC),
        )

        reconciler = BillingReconciler(None)  # type: ignore
        reconciler._compare_line_items(result, expected, actual)

        amount_mismatches = [
            m for m in result.mismatches
            if "amount" in m.classification.value or "Line item amount" in m.message
        ]
        assert len(amount_mismatches) == 1
        assert amount_mismatches[0].difference == -1000  # 9000 - 10000


class TestOrderTotalsComparison:
    """Test order totals comparison logic."""

    def test_detect_subtotal_mismatch(self) -> None:
        """Subtotal mismatch is detected."""
        subscription_id = uuid4()
        order_id = uuid4()
        period_start = datetime.now(UTC)
        period_end = period_start + timedelta(days=30)

        expected = ExpectedOrder(
            stable_id="test",
            subscription_id=subscription_id,
            customer_id=uuid4(),
            product_id=uuid4(),
            billing_reason="subscription_cycle",
            currency="usd",
            subtotal_amount=10000,
            discount_amount=0,
            tax_amount=0,
            total_amount=10000,
            applied_balance_amount=0,
            due_amount=10000,
            period_start=period_start,
            period_end=period_end,
            line_items=(),
        )

        actual = ActualOrder(
            order_id=order_id,
            subscription_id=subscription_id,
            customer_id=uuid4(),
            product_id=uuid4(),
            billing_reason="subscription_cycle",
            currency="usd",
            status="paid",
            subtotal_amount=9500,  # Different!
            discount_amount=0,
            tax_amount=0,
            total_amount=9500,
            applied_balance_amount=0,
            period_start=period_start,
            period_end=period_end,
            line_items=(),
        )

        result = ReconciliationResult(
            run_id="test",
            started_at=datetime.now(UTC),
        )

        reconciler = BillingReconciler(None)  # type: ignore
        reconciler._compare_order_totals(result, expected, actual)

        subtotal_mismatches = [
            m for m in result.mismatches
            if "subtotal" in m.message.lower()
        ]
        assert len(subtotal_mismatches) == 1
        assert subtotal_mismatches[0].expected_value == 10000
        assert subtotal_mismatches[0].actual_value == 9500

    def test_detect_discount_mismatch(self) -> None:
        """Discount mismatch is detected."""
        subscription_id = uuid4()
        order_id = uuid4()
        period_start = datetime.now(UTC)
        period_end = period_start + timedelta(days=30)

        expected = ExpectedOrder(
            stable_id="test",
            subscription_id=subscription_id,
            customer_id=uuid4(),
            product_id=uuid4(),
            billing_reason="subscription_cycle",
            currency="usd",
            subtotal_amount=10000,
            discount_amount=1000,  # 10% discount
            tax_amount=0,
            total_amount=9000,
            applied_balance_amount=0,
            due_amount=9000,
            period_start=period_start,
            period_end=period_end,
            line_items=(),
        )

        actual = ActualOrder(
            order_id=order_id,
            subscription_id=subscription_id,
            customer_id=uuid4(),
            product_id=uuid4(),
            billing_reason="subscription_cycle",
            currency="usd",
            status="paid",
            subtotal_amount=10000,
            discount_amount=500,  # Different discount!
            tax_amount=0,
            total_amount=9500,
            applied_balance_amount=0,
            period_start=period_start,
            period_end=period_end,
            line_items=(),
        )

        result = ReconciliationResult(
            run_id="test",
            started_at=datetime.now(UTC),
        )

        reconciler = BillingReconciler(None)  # type: ignore
        reconciler._compare_order_totals(result, expected, actual)

        discount_mismatches = [
            m for m in result.mismatches
            if m.classification == MismatchClassification.discount_mismatch
        ]
        assert len(discount_mismatches) == 1
        assert discount_mismatches[0].expected_value == 1000
        assert discount_mismatches[0].actual_value == 500

    def test_detect_tax_mismatch(self) -> None:
        """Tax mismatch is detected."""
        subscription_id = uuid4()
        order_id = uuid4()
        period_start = datetime.now(UTC)
        period_end = period_start + timedelta(days=30)

        expected = ExpectedOrder(
            stable_id="test",
            subscription_id=subscription_id,
            customer_id=uuid4(),
            product_id=uuid4(),
            billing_reason="subscription_cycle",
            currency="usd",
            subtotal_amount=10000,
            discount_amount=0,
            tax_amount=1000,  # 10% tax
            total_amount=11000,
            applied_balance_amount=0,
            due_amount=11000,
            period_start=period_start,
            period_end=period_end,
            line_items=(),
        )

        actual = ActualOrder(
            order_id=order_id,
            subscription_id=subscription_id,
            customer_id=uuid4(),
            product_id=uuid4(),
            billing_reason="subscription_cycle",
            currency="usd",
            status="paid",
            subtotal_amount=10000,
            discount_amount=0,
            tax_amount=800,  # Different tax!
            total_amount=10800,
            applied_balance_amount=0,
            period_start=period_start,
            period_end=period_end,
            line_items=(),
        )

        result = ReconciliationResult(
            run_id="test",
            started_at=datetime.now(UTC),
        )

        reconciler = BillingReconciler(None)  # type: ignore
        reconciler._compare_order_totals(result, expected, actual)

        tax_mismatches = [
            m for m in result.mismatches
            if m.classification == MismatchClassification.tax_mismatch
        ]
        assert len(tax_mismatches) == 1
        assert tax_mismatches[0].expected_value == 1000
        assert tax_mismatches[0].actual_value == 800
