"""
Billing Oracle: Deterministic billing simulation engine.

The Oracle simulates expected billing outcomes based on:
- Subscription state (prices, periods, status)
- Billing entries (cycle, proration, metered)
- Discount rules (once, forever, repeating)
- Tax configuration

All computations are deterministic and produce immutable ExpectedOrder objects
that can be compared against actual production artifacts.

Key invariants the Oracle enforces:
1. Conservation: order.total == sum(line_items) + tax - discount
2. Idempotency: replaying same events produces same artifacts
3. Monotonicity: increasing usage never decreases usage charge
4. Boundary safety: events at period boundaries are handled consistently
"""

from datetime import datetime
from decimal import Decimal
from typing import Sequence, cast
from uuid import UUID

import structlog

from polar.kit.math import polar_round
from polar.models import (
    BillingEntry,
    Customer,
    Discount,
    Order,
    Product,
    Subscription,
    SubscriptionProductPrice,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.discount import DiscountDuration, DiscountFixed, DiscountPercentage
from polar.models.product_price import (
    ProductPriceAmountType,
    ProductPriceMeteredUnit,
    ProductPriceSeatUnit,
)
from polar.product.guard import is_metered_price, is_static_price

from .models import (
    ExpectedLineItem,
    ExpectedOrder,
    ExpectedSubscriptionState,
)

log = structlog.get_logger(__name__)


class BillingOracle:
    """
    Deterministic billing simulation engine.

    Computes expected billing artifacts from subscription state and billing entries.
    All methods are pure functions that don't modify any state.
    """

    def simulate_subscription_cycle_order(
        self,
        subscription: Subscription,
        billing_entries: Sequence[BillingEntry],
        billing_reason: str,
        customer_balance: int = 0,
        tax_rate: Decimal | None = None,
        tax_inclusive: bool = False,
    ) -> ExpectedOrder:
        """
        Simulate the expected order for a subscription billing cycle.

        Args:
            subscription: The subscription being billed
            billing_entries: Billing entries for this cycle
            billing_reason: The billing reason (cycle, cycle_after_trial, etc.)
            customer_balance: Customer wallet balance (negative = credit available)
            tax_rate: Tax rate to apply (as decimal, e.g., 0.20 for 20%)
            tax_inclusive: Whether prices include tax

        Returns:
            ExpectedOrder with all computed line items and totals
        """
        line_items = self._compute_line_items(
            subscription=subscription,
            billing_entries=billing_entries,
        )

        # Calculate subtotal from line items
        subtotal = sum(item.amount for item in line_items)

        # Apply discount if applicable
        discount_amount = 0
        discount = subscription.discount
        if discount is not None and self._is_discount_applicable(
            discount, subscription, subscription.product
        ):
            discount_amount = self._compute_discount_amount(discount, subtotal)

        net_amount = max(0, subtotal - discount_amount)

        # Calculate tax
        tax_amount = 0
        if tax_rate is not None and net_amount > 0:
            if tax_inclusive:
                # Extract tax from net amount
                tax_amount = polar_round(net_amount - (net_amount / (1 + tax_rate)))
            else:
                # Add tax on top
                tax_amount = polar_round(net_amount * tax_rate)

        total_amount = net_amount + tax_amount

        # Apply customer balance
        applied_balance = 0
        if customer_balance < 0:  # Negative means credit available
            applied_balance = max(-total_amount, customer_balance)

        due_amount = max(0, total_amount + applied_balance)

        # Build stable ID
        period_start = subscription.current_period_start
        stable_id = ExpectedOrder.compute_stable_id(
            subscription_id=subscription.id,
            period_start=period_start,
            billing_reason=billing_reason,
        )

        return ExpectedOrder(
            stable_id=stable_id,
            subscription_id=subscription.id,
            customer_id=subscription.customer_id,
            product_id=subscription.product_id,
            billing_reason=billing_reason,
            currency=subscription.currency,
            subtotal_amount=subtotal,
            discount_amount=discount_amount,
            tax_amount=tax_amount,
            total_amount=total_amount,
            applied_balance_amount=applied_balance,
            due_amount=due_amount,
            period_start=subscription.current_period_start,
            period_end=subscription.current_period_end or subscription.current_period_start,
            discount_id=discount.id if discount else None,
            discount_type=discount.type.value if discount else None,
            discount_basis_points=discount.basis_points if isinstance(discount, DiscountPercentage) else None,
            discount_fixed_amount=discount.amount if isinstance(discount, DiscountFixed) else None,
            line_items=tuple(line_items),
        )

    def simulate_subscription_state(
        self,
        subscription: Subscription,
    ) -> ExpectedSubscriptionState:
        """
        Compute the expected subscription state.

        Returns an immutable snapshot of what the subscription state should be.
        """
        next_renewal_at = None
        if subscription.active and subscription.current_period_end:
            next_renewal_at = subscription.current_period_end

        return ExpectedSubscriptionState(
            subscription_id=subscription.id,
            status=subscription.status.value,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            next_renewal_at=next_renewal_at,
            cancel_at_period_end=subscription.cancel_at_period_end,
            amount=subscription.amount,
            currency=subscription.currency,
            trial_start=subscription.trial_start,
            trial_end=subscription.trial_end,
            discount_id=subscription.discount_id,
            discount_applied_at=subscription.discount_applied_at,
        )

    def _compute_line_items(
        self,
        subscription: Subscription,
        billing_entries: Sequence[BillingEntry],
    ) -> list[ExpectedLineItem]:
        """
        Compute expected line items from billing entries.

        Groups entries by type and computes amounts based on pricing rules.
        """
        line_items: list[ExpectedLineItem] = []

        # Group entries by price and type
        static_entries: list[BillingEntry] = []
        metered_entries_by_price: dict[UUID, list[BillingEntry]] = {}

        for entry in billing_entries:
            if entry.order_item_id is not None:
                # Already billed, skip
                continue

            price = entry.product_price
            if is_static_price(price):
                static_entries.append(entry)
            elif is_metered_price(price):
                price_id = price.id
                if price_id not in metered_entries_by_price:
                    metered_entries_by_price[price_id] = []
                metered_entries_by_price[price_id].append(entry)

        # Process static entries (one line item per entry)
        for entry in static_entries:
            line_item = self._compute_static_line_item(subscription, entry)
            line_items.append(line_item)

        # Process metered entries (aggregate by price)
        for price_id, entries in metered_entries_by_price.items():
            line_item = self._compute_metered_line_item(subscription, entries)
            if line_item is not None:
                line_items.append(line_item)

        return line_items

    def _compute_static_line_item(
        self,
        subscription: Subscription,
        entry: BillingEntry,
    ) -> ExpectedLineItem:
        """Compute a line item for a static price entry."""
        price = entry.product_price
        assert entry.amount is not None
        assert entry.currency is not None

        amount = entry.amount
        if entry.direction == BillingEntryDirection.credit:
            amount = -amount

        # Determine label based on entry type
        product_name = price.product.name if price.product else "Product"
        if entry.direction == BillingEntryDirection.credit:
            label = f"Remaining time on {product_name}"
        else:
            label = product_name

        stable_id = ExpectedLineItem.compute_stable_id(
            subscription_id=subscription.id,
            period_start=entry.start_timestamp,
            price_id=price.id,
            entry_type=entry.type.value,
        )

        return ExpectedLineItem(
            stable_id=stable_id,
            label=label,
            amount=amount,
            currency=entry.currency,
            tax_amount=0,  # Tax computed at order level
            proration=entry.type == BillingEntryType.proration,
            price_id=price.id,
            period_start=entry.start_timestamp,
            period_end=entry.end_timestamp,
            entry_type=entry.type.value,
        )

    def _compute_metered_line_item(
        self,
        subscription: Subscription,
        entries: Sequence[BillingEntry],
    ) -> ExpectedLineItem | None:
        """
        Compute a line item for metered price entries.

        Aggregates all entries for the same price and computes the total amount
        based on the metered pricing formula.
        """
        if not entries:
            return None

        first_entry = entries[0]
        price = first_entry.product_price
        assert isinstance(price, ProductPriceMeteredUnit)

        # Aggregate consumed units from all entries
        # For metered entries, we need to count them (each entry = 1 event typically)
        # The actual units come from the meter aggregation
        consumed_units = Decimal(len(entries))

        # TODO: Get actual consumed units from meter aggregation
        # For now, assume 1 unit per entry
        credited_units = 0

        billable_units = max(Decimal(0), consumed_units - credited_units)
        amount, label = price.get_amount_and_label(float(billable_units))

        meter_name = price.meter.name if price.meter else "Usage"
        label = f"{meter_name} - {label}"

        # Find period boundaries
        start_timestamp = min(e.start_timestamp for e in entries)
        end_timestamp = max(e.end_timestamp for e in entries)

        stable_id = ExpectedLineItem.compute_stable_id(
            subscription_id=subscription.id,
            period_start=start_timestamp,
            price_id=price.id,
            entry_type=BillingEntryType.metered.value,
        )

        return ExpectedLineItem(
            stable_id=stable_id,
            label=label,
            amount=amount,
            currency=price.price_currency,
            tax_amount=0,
            proration=False,
            price_id=price.id,
            period_start=start_timestamp,
            period_end=end_timestamp,
            entry_type=BillingEntryType.metered.value,
            consumed_units=consumed_units,
            credited_units=credited_units,
            unit_amount=price.unit_amount,
        )

    def _is_discount_applicable(
        self,
        discount: Discount,
        subscription: Subscription,
        product: Product,
    ) -> bool:
        """Check if a discount is applicable for the current billing cycle."""
        # Check product applicability
        if not discount.is_applicable(product, subscription.currency):
            return False

        # Check duration/repetition
        if subscription.discount_applied_at is not None:
            if discount.is_repetition_expired(
                subscription.discount_applied_at,
                subscription.current_period_start,
            ):
                return False

        return True

    def _compute_discount_amount(
        self,
        discount: Discount,
        subtotal: int,
    ) -> int:
        """Compute the discount amount for a given subtotal."""
        return discount.get_discount_amount(subtotal)

    # =========================================================================
    # Invariant checks (for property-based testing)
    # =========================================================================

    def check_conservation_invariant(self, order: ExpectedOrder) -> bool:
        """
        Check: order.total == sum(line_items) - discount + tax

        This is the fundamental billing equation that must always hold.
        """
        line_item_total = sum(item.amount for item in order.line_items)
        expected_total = line_item_total - order.discount_amount + order.tax_amount
        return order.total_amount == expected_total

    def check_non_negative_invariant(self, order: ExpectedOrder) -> bool:
        """
        Check: due_amount >= 0

        Customers should never owe negative amounts.
        """
        return order.due_amount >= 0

    def check_balance_application_invariant(self, order: ExpectedOrder) -> bool:
        """
        Check: applied_balance <= total_amount

        Can't apply more balance than the order total.
        """
        # applied_balance is negative (credit), so abs(applied_balance) <= total
        return abs(order.applied_balance_amount) <= order.total_amount


# Singleton instance
billing_oracle = BillingOracle()
