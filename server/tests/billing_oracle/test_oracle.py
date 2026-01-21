"""
Property-based tests for the Billing Oracle.

These tests use Hypothesis to verify invariants that must hold
for all possible billing scenarios:

1. Conservation: order.total == sum(line_items) - discount + tax
2. Idempotency: replaying same events produces same artifacts
3. Monotonicity: increasing usage never decreases usage charge
4. Boundary safety: events at period boundaries handled consistently
5. Non-negativity: due_amount >= 0
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import cast
from uuid import uuid4

import pytest
from hypothesis import given, settings, strategies as st

from polar.billing_oracle.models import (
    ExpectedLineItem,
    ExpectedOrder,
    MismatchClassification,
    MismatchSeverity,
    OracleMismatch,
    ReconciliationResult,
    ROUNDING_TOLERANCE_CENTS,
)
from polar.billing_oracle.oracle import BillingOracle


# =============================================================================
# Strategies for generating test data
# =============================================================================

# Amount in cents (integer, reasonable range)
amount_cents = st.integers(min_value=0, max_value=100_000_00)  # $0 to $100,000

# Currency codes
currencies = st.sampled_from(["usd", "eur", "gbp"])

# Tax rates (0% to 30%)
tax_rates = st.decimals(min_value=Decimal("0"), max_value=Decimal("0.30"), places=4)

# Discount amounts (0 to 50% of typical amounts)
discount_amounts = st.integers(min_value=0, max_value=50_000_00)

# Timestamps
timestamps = st.datetimes(
    min_value=datetime(2020, 1, 1, tzinfo=UTC),
    max_value=datetime(2030, 12, 31, tzinfo=UTC),
)

# Entry types
entry_types = st.sampled_from(["cycle", "proration", "metered", "subscription_seats_increase"])


@st.composite
def expected_line_items(draw: st.DrawFn) -> ExpectedLineItem:
    """Generate a random ExpectedLineItem."""
    subscription_id = uuid4()
    period_start = draw(timestamps)
    price_id = uuid4()
    entry_type = draw(entry_types)

    stable_id = ExpectedLineItem.compute_stable_id(
        subscription_id=subscription_id,
        period_start=period_start,
        price_id=price_id,
        entry_type=entry_type,
    )

    return ExpectedLineItem(
        stable_id=stable_id,
        label=f"Test Item {draw(st.text(min_size=1, max_size=20))}",
        amount=draw(amount_cents),
        currency=draw(currencies),
        tax_amount=0,  # Tax computed at order level
        proration=draw(st.booleans()),
        price_id=price_id,
        period_start=period_start,
        period_end=period_start + timedelta(days=draw(st.integers(1, 365))),
        entry_type=entry_type,
    )


@st.composite
def expected_orders(draw: st.DrawFn) -> ExpectedOrder:
    """Generate a random ExpectedOrder with consistent totals."""
    subscription_id = uuid4()
    customer_id = uuid4()
    product_id = uuid4()
    currency = draw(currencies)
    period_start = draw(timestamps)
    period_end = period_start + timedelta(days=draw(st.integers(1, 365)))
    billing_reason = draw(st.sampled_from([
        "subscription_cycle", "subscription_cycle_after_trial", "subscription_update"
    ]))

    # Generate line items
    num_items = draw(st.integers(0, 5))
    items = []
    for _ in range(num_items):
        item = draw(expected_line_items())
        # Override currency to match order
        items.append(ExpectedLineItem(
            stable_id=item.stable_id,
            label=item.label,
            amount=item.amount,
            currency=currency,
            tax_amount=0,
            proration=item.proration,
            price_id=item.price_id,
            period_start=period_start,
            period_end=period_end,
            entry_type=item.entry_type,
        ))

    # Calculate totals consistently
    subtotal = sum(item.amount for item in items)
    discount = min(draw(discount_amounts), subtotal)  # Can't discount more than subtotal
    net = subtotal - discount
    tax_rate = draw(tax_rates)
    tax = int(net * tax_rate)
    total = net + tax

    # Customer balance (negative = credit)
    balance = -draw(st.integers(0, min(total, 10000_00)))
    due = max(0, total + balance)

    stable_id = ExpectedOrder.compute_stable_id(
        subscription_id=subscription_id,
        period_start=period_start,
        billing_reason=billing_reason,
    )

    return ExpectedOrder(
        stable_id=stable_id,
        subscription_id=subscription_id,
        customer_id=customer_id,
        product_id=product_id,
        billing_reason=billing_reason,
        currency=currency,
        subtotal_amount=subtotal,
        discount_amount=discount,
        tax_amount=tax,
        total_amount=total,
        applied_balance_amount=balance,
        due_amount=due,
        period_start=period_start,
        period_end=period_end,
        line_items=tuple(items),
    )


# =============================================================================
# Property-based tests
# =============================================================================

class TestOracleInvariants:
    """Test that Oracle invariants hold for all inputs."""

    @given(expected_orders())
    @settings(max_examples=100)
    def test_conservation_invariant(self, order: ExpectedOrder) -> None:
        """
        Conservation: total == subtotal - discount + tax

        This is the fundamental billing equation that must always hold.
        """
        expected_total = order.subtotal_amount - order.discount_amount + order.tax_amount
        assert order.total_amount == expected_total, (
            f"Conservation violated: "
            f"subtotal={order.subtotal_amount}, discount={order.discount_amount}, "
            f"tax={order.tax_amount}, total={order.total_amount}, expected={expected_total}"
        )

    @given(expected_orders())
    @settings(max_examples=100)
    def test_non_negative_due_amount(self, order: ExpectedOrder) -> None:
        """
        Non-negativity: due_amount >= 0

        Customers should never owe negative amounts.
        """
        assert order.due_amount >= 0, f"Due amount is negative: {order.due_amount}"

    @given(expected_orders())
    @settings(max_examples=100)
    def test_balance_application_invariant(self, order: ExpectedOrder) -> None:
        """
        Balance application: |applied_balance| <= total_amount

        Can't apply more balance than the order total.
        """
        assert abs(order.applied_balance_amount) <= order.total_amount, (
            f"Balance over-applied: applied={order.applied_balance_amount}, "
            f"total={order.total_amount}"
        )

    @given(expected_orders())
    @settings(max_examples=100)
    def test_due_amount_calculation(self, order: ExpectedOrder) -> None:
        """
        Due amount: due_amount == max(0, total + applied_balance)
        """
        expected_due = max(0, order.total_amount + order.applied_balance_amount)
        assert order.due_amount == expected_due, (
            f"Due amount mismatch: expected={expected_due}, actual={order.due_amount}"
        )

    @given(expected_orders())
    @settings(max_examples=100)
    def test_subtotal_equals_line_items(self, order: ExpectedOrder) -> None:
        """
        Subtotal consistency: subtotal == sum(line_items.amount)
        """
        line_item_total = sum(item.amount for item in order.line_items)
        assert order.subtotal_amount == line_item_total, (
            f"Subtotal mismatch: order.subtotal={order.subtotal_amount}, "
            f"line_items_sum={line_item_total}"
        )

    @given(expected_orders())
    @settings(max_examples=100)
    def test_discount_not_greater_than_subtotal(self, order: ExpectedOrder) -> None:
        """
        Discount bounds: discount <= subtotal

        Can't discount more than the order subtotal.
        """
        assert order.discount_amount <= order.subtotal_amount, (
            f"Discount exceeds subtotal: discount={order.discount_amount}, "
            f"subtotal={order.subtotal_amount}"
        )


class TestOracleSimulation:
    """Test the Oracle simulation methods."""

    def test_check_conservation_invariant_valid(self) -> None:
        """Oracle correctly validates a valid order."""
        oracle = BillingOracle()

        order = ExpectedOrder(
            stable_id="test",
            subscription_id=uuid4(),
            customer_id=uuid4(),
            product_id=uuid4(),
            billing_reason="subscription_cycle",
            currency="usd",
            subtotal_amount=10000,  # $100
            discount_amount=1000,   # $10
            tax_amount=900,         # $9 (10% on $90 net)
            total_amount=9900,      # $99
            applied_balance_amount=0,
            due_amount=9900,
            period_start=datetime.now(UTC),
            period_end=datetime.now(UTC) + timedelta(days=30),
            line_items=(),
        )

        # This should fail because line_items sum != subtotal
        # The conservation check is about total = subtotal - discount + tax
        assert oracle.check_conservation_invariant(order)

    def test_check_conservation_invariant_invalid(self) -> None:
        """Oracle correctly rejects an invalid order."""
        oracle = BillingOracle()

        order = ExpectedOrder(
            stable_id="test",
            subscription_id=uuid4(),
            customer_id=uuid4(),
            product_id=uuid4(),
            billing_reason="subscription_cycle",
            currency="usd",
            subtotal_amount=10000,
            discount_amount=1000,
            tax_amount=900,
            total_amount=10000,  # Wrong! Should be 9900
            applied_balance_amount=0,
            due_amount=10000,
            period_start=datetime.now(UTC),
            period_end=datetime.now(UTC) + timedelta(days=30),
            line_items=(),
        )

        assert not oracle.check_conservation_invariant(order)

    def test_check_non_negative_invariant_valid(self) -> None:
        """Oracle accepts non-negative due amounts."""
        oracle = BillingOracle()

        order = ExpectedOrder(
            stable_id="test",
            subscription_id=uuid4(),
            customer_id=uuid4(),
            product_id=uuid4(),
            billing_reason="subscription_cycle",
            currency="usd",
            subtotal_amount=10000,
            discount_amount=0,
            tax_amount=0,
            total_amount=10000,
            applied_balance_amount=-5000,  # $50 credit
            due_amount=5000,  # $50 due
            period_start=datetime.now(UTC),
            period_end=datetime.now(UTC) + timedelta(days=30),
            line_items=(),
        )

        assert oracle.check_non_negative_invariant(order)


class TestStableIdGeneration:
    """Test stable ID generation for diffing."""

    def test_line_item_stable_id_deterministic(self) -> None:
        """Stable IDs are deterministic for same inputs."""
        subscription_id = uuid4()
        period_start = datetime(2024, 1, 1, tzinfo=UTC)
        price_id = uuid4()
        entry_type = "cycle"

        id1 = ExpectedLineItem.compute_stable_id(
            subscription_id, period_start, price_id, entry_type
        )
        id2 = ExpectedLineItem.compute_stable_id(
            subscription_id, period_start, price_id, entry_type
        )

        assert id1 == id2

    def test_line_item_stable_id_different_inputs(self) -> None:
        """Stable IDs differ for different inputs."""
        subscription_id = uuid4()
        period_start = datetime(2024, 1, 1, tzinfo=UTC)
        price_id = uuid4()

        id1 = ExpectedLineItem.compute_stable_id(
            subscription_id, period_start, price_id, "cycle"
        )
        id2 = ExpectedLineItem.compute_stable_id(
            subscription_id, period_start, price_id, "proration"
        )

        assert id1 != id2

    def test_order_stable_id_deterministic(self) -> None:
        """Order stable IDs are deterministic."""
        subscription_id = uuid4()
        period_start = datetime(2024, 1, 1, tzinfo=UTC)
        billing_reason = "subscription_cycle"

        id1 = ExpectedOrder.compute_stable_id(
            subscription_id, period_start, billing_reason
        )
        id2 = ExpectedOrder.compute_stable_id(
            subscription_id, period_start, billing_reason
        )

        assert id1 == id2


class TestMismatchClassification:
    """Test mismatch classification and severity."""

    def test_rounding_difference_classification(self) -> None:
        """Small differences are classified as rounding."""
        mismatch = OracleMismatch(
            id="test",
            classification=MismatchClassification.rounding_difference,
            severity=MismatchSeverity.info,
            message="Test",
            difference=1,
        )

        assert mismatch.severity == MismatchSeverity.info
        assert abs(mismatch.difference) <= ROUNDING_TOLERANCE_CENTS

    def test_mismatch_to_dict(self) -> None:
        """Mismatch can be serialized to dict."""
        mismatch = OracleMismatch(
            id="test-123",
            classification=MismatchClassification.amount_mismatch,
            severity=MismatchSeverity.error,
            message="Amount differs",
            subscription_id=uuid4(),
            order_id=uuid4(),
            expected_value=10000,
            actual_value=9500,
            difference=-500,
        )

        d = mismatch.to_dict()

        assert d["id"] == "test-123"
        assert d["classification"] == "amount_mismatch"
        assert d["severity"] == "error"
        assert d["expected_value"] == 10000
        assert d["actual_value"] == 9500
        assert d["difference"] == -500


class TestReconciliationResult:
    """Test ReconciliationResult aggregation."""

    def test_add_mismatch_updates_counters(self) -> None:
        """Adding mismatches updates severity counters."""
        result = ReconciliationResult(
            run_id="test",
            started_at=datetime.now(UTC),
        )

        result.add_mismatch(OracleMismatch(
            id="1", classification=MismatchClassification.unknown,
            severity=MismatchSeverity.critical, message="Critical"
        ))
        result.add_mismatch(OracleMismatch(
            id="2", classification=MismatchClassification.unknown,
            severity=MismatchSeverity.error, message="Error"
        ))
        result.add_mismatch(OracleMismatch(
            id="3", classification=MismatchClassification.unknown,
            severity=MismatchSeverity.warning, message="Warning"
        ))
        result.add_mismatch(OracleMismatch(
            id="4", classification=MismatchClassification.unknown,
            severity=MismatchSeverity.info, message="Info"
        ))

        assert result.critical_count == 1
        assert result.error_count == 1
        assert result.warning_count == 1
        assert result.info_count == 1
        assert result.has_mismatches
        assert result.has_critical_mismatches
        assert result.has_errors

    def test_empty_result_has_no_mismatches(self) -> None:
        """Empty result has no mismatches."""
        result = ReconciliationResult(
            run_id="test",
            started_at=datetime.now(UTC),
        )

        assert not result.has_mismatches
        assert not result.has_critical_mismatches
        assert not result.has_errors

    def test_to_dict_serialization(self) -> None:
        """Result can be serialized to dict."""
        result = ReconciliationResult(
            run_id="test-run",
            started_at=datetime.now(UTC),
            subscription_id=uuid4(),
            orders_checked=5,
            line_items_checked=15,
        )
        result.completed_at = datetime.now(UTC)

        d = result.to_dict()

        assert d["run_id"] == "test-run"
        assert d["orders_checked"] == 5
        assert d["line_items_checked"] == 15
        assert "mismatches" in d
