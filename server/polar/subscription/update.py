from datetime import datetime

from parse import Decimal

from polar.enums import SubscriptionProrationBehavior
from polar.kit.utils import utc_now
from polar.models import BillingEntry, Product, Subscription, SubscriptionUpdate
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.product_price import ProductPriceSeatUnit
from polar.product.guard import (
    is_fixed_price,
    is_recurring_product,
    is_seat_price,
)
from polar.product.price_set import PriceSet


def _calculate_time_proration(
    period_start: datetime, period_end: datetime, now: datetime
) -> Decimal:
    """
    Calculate proration factor for a time period.

    Returns:
        Decimal between 0 and 1 representing percentage of time remaining.
    """
    period_total = (period_end - period_start).total_seconds()
    time_remaining = (period_end - now).total_seconds()

    if time_remaining <= 0:
        return Decimal(0)

    return Decimal(time_remaining) / Decimal(period_total)


def _generate_product_credit_proration_billing_entries(
    *,
    subscription: Subscription,
    applies_at: datetime,
    initial_cycle_start: datetime,
    initial_cycle_end: datetime,
) -> list[BillingEntry]:
    billing_entries: list[BillingEntry] = []

    initial_cycle_pct_remaining = _calculate_time_proration(
        initial_cycle_start, initial_cycle_end, applies_at
    )

    for initial_price in subscription.prices:
        # Metered and free prices don't get prorated
        if is_fixed_price(initial_price):
            base_amount = initial_price.price_amount
        elif is_seat_price(initial_price) and subscription.seats is not None:
            base_amount = initial_price.calculate_amount(subscription.seats)
        else:
            continue
        discount_amount = 0
        if subscription.discount:
            discount_amount = subscription.discount.get_discount_amount(
                base_amount, subscription.currency
            )

        # Prorations have discounts applied to the `BillingEntry.amount`
        # immediately.
        # This is because we're really applying the discount from "this" cycle
        # whereas the `cycle` and `meter` BillingEntries should use the
        # discount from the _next_ cycle -- the discount that applies to
        # that upcoming order. applies to next order applies to the
        # For example, if you have a flat "$20 off" discount, part of that
        # $20 discount should _not_ apply to the prorations because the
        # prorations are happening "this cycle" and shouldn't take away
        # from next cycle's discount.
        entry_unused_time = BillingEntry(
            type=BillingEntryType.proration,
            direction=BillingEntryDirection.credit,
            start_timestamp=applies_at,
            end_timestamp=initial_cycle_end,
            amount=round((base_amount - discount_amount) * initial_cycle_pct_remaining),
            discount_amount=discount_amount,
            currency=subscription.currency,
            customer=subscription.customer,
            product_price=initial_price,
            subscription=subscription,
        )
        billing_entries.append(entry_unused_time)

    return billing_entries


def _generate_product_debit_proration_billing_entries(
    *,
    subscription: Subscription,
    new_product: Product,
    applies_at: datetime,
    new_cycle_start: datetime,
    new_cycle_end: datetime,
) -> list[BillingEntry]:
    billing_entries: list[BillingEntry] = []

    new_cycle_pct_remaining = _calculate_time_proration(
        new_cycle_start, new_cycle_end, applies_at
    )

    new_prices = PriceSet.from_product(new_product, subscription.currency)
    for new_price in new_prices:
        # Metered and free prices don't get prorated
        if is_fixed_price(new_price):
            base_amount = new_price.price_amount
        elif is_seat_price(new_price) and subscription.seats is not None:
            base_amount = new_price.calculate_amount(subscription.seats)
        else:
            continue
        discount_amount = 0
        if subscription.discount and subscription.discount.is_applicable(
            new_price.product, subscription.currency
        ):
            discount_amount = subscription.discount.get_discount_amount(
                base_amount, subscription.currency
            )

        entry_remaining_time = BillingEntry(
            type=BillingEntryType.proration,
            direction=BillingEntryDirection.debit,
            start_timestamp=applies_at,
            end_timestamp=new_cycle_end,
            amount=round((base_amount - discount_amount) * new_cycle_pct_remaining),
            discount_amount=discount_amount,
            currency=subscription.currency,
            customer=subscription.customer,
            product_price=new_price,
            subscription=subscription,
        )
        billing_entries.append(entry_remaining_time)

    return billing_entries


def _generate_product_subscription_update(
    subscription_update: SubscriptionUpdate,
) -> tuple[SubscriptionUpdate, list[BillingEntry]]:
    subscription = subscription_update.subscription

    current_product = subscription.product
    # We are checking for current_product.is_recurring instead of is_recurring_product
    # because legacy products will have is_recurring but not be of type RecurringProduct
    # which is_recurring_product asserts.
    assert current_product.is_recurring

    new_product = subscription_update.product
    assert new_product is not None
    assert is_recurring_product(new_product)

    if (
        subscription_update.is_interval_changed()
        or subscription_update.proration_behavior == SubscriptionProrationBehavior.reset
    ):
        new_cycle_start = subscription_update.applies_at
        new_cycle_end = new_product.recurring_interval.get_next_period(
            new_cycle_start, new_cycle_start.day, new_product.recurring_interval_count
        )
    else:
        # Don't change the cycle if we're just changing to a different product with the same interval or if the proration behavior is not reset
        new_cycle_start = subscription.current_period_start
        new_cycle_end = subscription.current_period_end

    subscription_update.new_cycle_start = new_cycle_start
    subscription_update.new_cycle_end = new_cycle_end

    billing_entries: list[BillingEntry] = []

    # Reset mode doesn't generate proration credits, it just invoices the full amount of the new plan immediately.
    if subscription_update.proration_behavior != SubscriptionProrationBehavior.reset:
        billing_entries.extend(
            _generate_product_credit_proration_billing_entries(
                subscription=subscription,
                applies_at=subscription_update.applies_at,
                initial_cycle_start=subscription.current_period_start,
                initial_cycle_end=subscription.current_period_end,
            )
        )

    billing_entries.extend(
        _generate_product_debit_proration_billing_entries(
            subscription=subscription,
            new_product=new_product,
            applies_at=subscription_update.applies_at,
            new_cycle_start=new_cycle_start,
            new_cycle_end=new_cycle_end,
        )
    )

    return subscription_update, billing_entries


def _generate_seats_subscription_update(
    subscription_update: SubscriptionUpdate,
) -> tuple[SubscriptionUpdate, list[BillingEntry]]:
    subscription = subscription_update.subscription
    old_seats = subscription.seats
    assert old_seats is not None
    new_seats = subscription_update.seats
    assert new_seats is not None

    seat_price = subscription.get_price_by_type(ProductPriceSeatUnit)
    assert seat_price is not None

    old_base_amount = seat_price.calculate_amount(old_seats)
    new_base_amount = seat_price.calculate_amount(new_seats)

    # Apply the discount to the old and new effective amounts, not to the delta.
    # Computing the discount on the delta double-counts fixed discounts: a $10
    # fixed discount applies once to the subscription total, not again to every
    # seat change.
    old_discount_amount = 0
    new_discount_amount = 0
    if subscription.discount and subscription.discount.is_applicable(
        subscription.product, subscription.currency
    ):
        old_discount_amount = subscription.discount.get_discount_amount(
            old_base_amount, subscription.currency
        )
        new_discount_amount = subscription.discount.get_discount_amount(
            new_base_amount, subscription.currency
        )

    start_timestamp = subscription_update.applies_at
    end_timestamp = subscription.current_period_end

    if subscription_update.proration_behavior == SubscriptionProrationBehavior.reset:
        # In reset mode, we don't prorate the amount, we just charge the full amount of the new seats immediately.
        proration_factor = Decimal(1)
        amount_delta = new_base_amount - new_discount_amount
        entry_discount_amount = new_discount_amount

        # Resets the cycle
        new_cycle_start = subscription_update.applies_at
        new_cycle_end = subscription.recurring_interval.get_next_period(
            new_cycle_start, new_cycle_start.day, subscription.recurring_interval_count
        )
        subscription_update.new_cycle_start = new_cycle_start
        subscription_update.new_cycle_end = end_timestamp = new_cycle_end
    else:
        proration_factor = _calculate_time_proration(
            subscription.current_period_start,
            subscription.current_period_end,
            subscription_update.applies_at,
        )
        old_effective = old_base_amount - old_discount_amount
        new_effective = new_base_amount - new_discount_amount
        amount_delta = new_effective - old_effective
        # The portion of the delta attributable to the discount is how much the
        # discount itself changed between the old and new effective amounts.
        entry_discount_amount = abs(new_discount_amount - old_discount_amount)

    prorated_amount = int(Decimal(amount_delta) * proration_factor)

    if prorated_amount == 0:
        return subscription_update, []

    if prorated_amount > 0:
        direction = BillingEntryDirection.debit
        entry_type = BillingEntryType.subscription_seats_increase
    else:
        direction = BillingEntryDirection.credit
        entry_type = BillingEntryType.subscription_seats_decrease
        prorated_amount = abs(prorated_amount)

    # Calculate prorated discount amount
    prorated_discount_amount = 0
    if entry_discount_amount > 0:
        prorated_discount_amount = int(
            Decimal(entry_discount_amount) * proration_factor
        )

    billing_entry = BillingEntry(
        start_timestamp=start_timestamp,
        end_timestamp=end_timestamp,
        subscription=subscription,
        customer=subscription.customer,
        product_price=seat_price,
        amount=prorated_amount,
        discount_amount=prorated_discount_amount
        if prorated_discount_amount > 0
        else None,
        discount=subscription.discount if entry_discount_amount > 0 else None,
        currency=subscription.currency,
        direction=direction,
        type=entry_type,
    )

    return subscription_update, [billing_entry]


def generate_subscription_update(
    subscription: Subscription,
    proration_behavior: SubscriptionProrationBehavior,
    *,
    product: Product | None = None,
    seats: int | None = None,
) -> tuple[SubscriptionUpdate, list[BillingEntry]]:
    match proration_behavior:
        case (
            SubscriptionProrationBehavior.invoice
            | SubscriptionProrationBehavior.reset
            | SubscriptionProrationBehavior.prorate
        ):
            applies_at = utc_now()
        case SubscriptionProrationBehavior.next_period:
            applies_at = subscription.current_period_end

    subscription_update = SubscriptionUpdate(
        proration_behavior=proration_behavior,
        applies_at=applies_at,
        subscription=subscription,
        subscription_id=subscription.id,
        product=product,
        seats=seats,
    )

    if product is not None:
        return _generate_product_subscription_update(subscription_update)

    if seats is not None:
        return _generate_seats_subscription_update(subscription_update)

    raise NotImplementedError("Only product and seats updates are supported")
