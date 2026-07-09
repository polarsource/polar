from .base import Invariant, InvariantError
from .subscriptions_canceled_deleted_customer import (
    SubscriptionsCanceledDeletedCustomerInvariant,
)
from .subscriptions_current_period_end import SubscriptionsCurrentPeriodEndInvariant
from .subscriptions_future_period_start import SubscriptionsFuturePeriodStartInvariant
from .subscriptions_locked_invariant import SubscriptionsLockedInvariant

INVARIANTS: set[type[Invariant]] = {
    SubscriptionsCanceledDeletedCustomerInvariant,
    SubscriptionsCurrentPeriodEndInvariant,
    SubscriptionsFuturePeriodStartInvariant,
    SubscriptionsLockedInvariant,
}

__all__ = ["INVARIANTS", "Invariant", "InvariantError"]
