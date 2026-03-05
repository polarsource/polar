from datetime import datetime

from parse import Decimal

from polar.kit.utils import utc_now
from polar.models import BillingEntry, Product, Subscription, SubscriptionUpdate
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.product_price import ProductPriceSeatUnit
from polar.product.guard import (
    is_fixed_price,
    is_recurring_product,
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
        if not is_fixed_price(initial_price):
            continue

        base_amount = initial_price.price_amount
        discount_amount = 0
        if subscription.discount:
            discount_amount = subscription.discount.get_discount_amount(base_amount)

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
        if not is_fixed_price(new_price):
            continue

        base_amount = new_price.price_amount
        discount_amount = 0
        if subscription.discount and subscription.discount.is_applicable(
            new_price.product, subscription.currency
        ):
            discount_amount = subscription.discount.get_discount_amount(base_amount)

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
    assert is_recurring_product(current_product)

    new_product = subscription_update.product
    assert new_product is not None
    assert is_recurring_product(new_product)

    if subscription_update.is_interval_changed():
        new_cycle_start = subscription_update.applies_at
    else:
        new_cycle_start = subscription.current_period_start

    new_cycle_end = new_product.recurring_interval.get_next_period(
        new_cycle_start, new_product.recurring_interval_count
    )

    subscription_update.new_cycle_start = new_cycle_start
    subscription_update.new_cycle_end = new_cycle_end

    billing_entries: list[BillingEntry] = []
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

    proration_factor = _calculate_time_proration(
        subscription.current_period_start,
        subscription.current_period_end,
        subscription_update.applies_at,
    )

    seat_price = subscription.get_price_by_type(ProductPriceSeatUnit)
    assert seat_price is not None

    old_base_amount = seat_price.calculate_amount(old_seats)
    new_base_amount = seat_price.calculate_amount(new_seats)
    base_amount_delta = new_base_amount - old_base_amount

    # Calculate discount on the delta amount
    discount_amount = 0
    if subscription.discount and subscription.discount.is_applicable(
        subscription.product, subscription.currency
    ):
        discount_amount = subscription.discount.get_discount_amount(
            abs(base_amount_delta)
        )

    # Calculate the net amount delta after discount
    if base_amount_delta > 0:
        # Increase: reduce the charge by discount
        amount_delta = base_amount_delta - discount_amount
    else:
        # Decrease: reduce the credit by discount
        amount_delta = base_amount_delta + discount_amount

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
    if discount_amount > 0:
        prorated_discount_amount = int(Decimal(discount_amount) * proration_factor)

    billing_entry = BillingEntry(
        start_timestamp=subscription_update.applies_at,
        end_timestamp=subscription.current_period_end,
        subscription=subscription,
        customer=subscription.customer,
        product_price=seat_price,
        amount=prorated_amount,
        discount_amount=prorated_discount_amount
        if prorated_discount_amount > 0
        else None,
        discount=subscription.discount if discount_amount > 0 else None,
        currency=subscription.currency,
        direction=direction,
        type=entry_type,
    )

    return subscription_update, [billing_entry]


def generate_subscription_update(
    subscription: Subscription,
    *,
    product: Product | None = None,
    seats: int | None = None,
) -> tuple[SubscriptionUpdate, list[BillingEntry]]:
    applies_at = utc_now()
    subscription_update = SubscriptionUpdate(
        applies_at=applies_at,
        subscription=subscription,
        product=product,
        seats=seats,
    )

    if product is not None:
        return _generate_product_subscription_update(subscription_update)

    if seats is not None:
        return _generate_seats_subscription_update(subscription_update)

    raise NotImplementedError("Only product and seats updates are supported")
