import time
from datetime import datetime

from polar.models import Subscription


class CanceledSubscriptionMock:
    def __init__(self, subscription: Subscription, revoke: bool = False) -> None:
        now = int(time.time())
        current_period_ends = int(datetime.timestamp(subscription.current_period_end))
        self.ended_at: int | None = None
        if revoke:
            self.status = "canceled"
            self.cancel_at_period_end = False
            self.current_period_end = current_period_ends
            self.canceled_at = now
            self.ends_at = now
            self.ended_at = now
        else:
            self.status = "active"
            self.cancel_at_period_end = True
            self.current_period_end = current_period_ends
            self.canceled_at = now
            self.ends_at = current_period_ends
            self.ended_at = None


def create_canceled_stripe_subscription(
    subscription: Subscription, revoke: bool = False
) -> CanceledSubscriptionMock:
    return CanceledSubscriptionMock(subscription, revoke=revoke)
