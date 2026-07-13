from datetime import datetime, timedelta

from sqlalchemy import func, select

from polar.kit.utils import utc_now
from polar.models import Subscription

from .base import Invariant, InvariantError


class NoRecentSubscriptionsInvariantError(InvariantError):
    """Exception raised when the NoRecentSubscriptionsInvariant check fails."""

    def __init__(
        self, threshold: timedelta, last_subscription_at: datetime | None
    ) -> None:
        message = (
            f"No new subscription created in the last {threshold}. "
            "The checkout or subscription pipeline may be stalled."
        )
        super().__init__(
            NoRecentSubscriptionsInvariant,
            message,
            {
                "threshold": str(threshold),
                "last_subscription_at": (
                    last_subscription_at.isoformat() if last_subscription_at else None
                ),
            },
        )


class NoRecentSubscriptionsInvariant(Invariant):
    """
    Invariant that checks a new subscription has been created recently.

    In production, subscriptions are created continuously. A prolonged silence does
    not happen under normal traffic and indicates the checkout or subscription
    pipeline is stalled.
    """

    THRESHOLD = timedelta(minutes=45)

    async def check(self) -> None:
        last_subscription_at = await self.session.scalar(
            select(func.max(Subscription.created_at))
        )

        if (
            last_subscription_at is None
            or last_subscription_at < utc_now() - self.THRESHOLD
        ):
            raise NoRecentSubscriptionsInvariantError(
                self.THRESHOLD, last_subscription_at
            )
