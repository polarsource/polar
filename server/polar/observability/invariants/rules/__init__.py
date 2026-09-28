from .base import Invariant, InvariantError
from .expired_records_not_deleted import ExpiredRecordsNotDeletedInvariant
from .external_events_unhandled import ExternalEventsUnhandledInvariant
from .no_recent_orders import NoRecentOrdersInvariant
from .no_recent_subscriptions import NoRecentSubscriptionsInvariant
from .payments_missing_transactions import PaymentsMissingTransactionsInvariant
from .payout_transactions_amount_invariant import PayoutTransactionsAmountInvariant
from .subscriptions_canceled_deleted_customer import (
    SubscriptionsCanceledDeletedCustomerInvariant,
)
from .subscriptions_current_period_end import SubscriptionsCurrentPeriodEndInvariant
from .subscriptions_future_period_start import SubscriptionsFuturePeriodStartInvariant
from .subscriptions_locked_invariant import SubscriptionsLockedInvariant

INVARIANTS: set[type[Invariant]] = {
    ExpiredRecordsNotDeletedInvariant,
    ExternalEventsUnhandledInvariant,
    NoRecentOrdersInvariant,
    NoRecentSubscriptionsInvariant,
    PaymentsMissingTransactionsInvariant,
    PayoutTransactionsAmountInvariant,
    SubscriptionsCanceledDeletedCustomerInvariant,
    SubscriptionsCurrentPeriodEndInvariant,
    SubscriptionsFuturePeriodStartInvariant,
    SubscriptionsLockedInvariant,
}

__all__ = ["INVARIANTS", "Invariant", "InvariantError"]
