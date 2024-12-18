import time
from datetime import datetime

from polar.models import Subscription


class CanceledSubscriptionMock:
    def __init__(self, subscription: Subscription) -> None:
        ends_at = int(datetime.timestamp(subscription.current_period_end))
        self.status = "active"
        self.cancel_at_period_end = True
        self.current_period_end = ends_at
        self.canceled_at = int(time.time())
        self.ends_at = ends_at
        self.ended_at = None


def create_canceled_stripe_subscription(
    subscription: Subscription,
) -> CanceledSubscriptionMock:
    return CanceledSubscriptionMock(subscription)
