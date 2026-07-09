import uuid
from datetime import timedelta

from sqlalchemy import func, over, select

from polar.models import Subscription

from .base import Invariant, InvariantError


class SubscriptionsLockedInvariantError(InvariantError):
    """Exception raised when the SubscriptionsCurrentPeriodEndInvariant check fails."""

    def __init__(self, count: int, subscriptions: list[uuid.UUID]) -> None:
        message = f"Found {count} subscriptions with too old scheduler_locked_at."
        super().__init__(
            SubscriptionsLockedInvariant,
            message,
            {
                "count": count,
                "subscriptions": {
                    "ids": subscriptions,
                    "has_more": count > len(subscriptions),
                },
            },
        )


class SubscriptionsLockedInvariant(Invariant):
    """
    Invariant that checks if there are any subscriptions that are locked for more than a certain period of time.

    Failure of this invariant indicate there is an issue with the subscription cycle process.
    """

    LEEWAY = timedelta(minutes=5)
    LIMIT = 10

    async def check(self) -> None:
        statement = (
            select(Subscription.id, over(func.count()))
            .where(
                Subscription.scheduler_locked_at.isnot(None),
                Subscription.scheduler_locked_at < (func.now() - self.LEEWAY),
            )
            .limit(self.LIMIT)
            .order_by(Subscription.scheduler_locked_at.asc(), Subscription.id.asc())
        )

        result = await self.session.execute(statement)
        results = result.fetchall()
        if len(results) > 0:
            count = results[0][1]
        else:
            count = 0

        if count > 0:
            subscriptions = [row[0] for row in results]
            raise SubscriptionsLockedInvariantError(count, subscriptions)
