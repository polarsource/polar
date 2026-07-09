import uuid

from sqlalchemy import func, over, select

from polar.models import Subscription

from .base import Invariant, InvariantError


class SubscriptionsFuturePeriodStartInvariantError(InvariantError):
    """Exception raised when the SubscriptionsFuturePeriodStartInvariant check fails."""

    def __init__(self, count: int, subscriptions: list[uuid.UUID]) -> None:
        message = (
            f"Found {count} subscriptions with current_period_start in the future."
        )
        super().__init__(
            SubscriptionsFuturePeriodStartInvariant,
            message,
            {
                "count": count,
                "subscriptions": {
                    "ids": subscriptions,
                    "has_more": count > len(subscriptions),
                },
            },
        )


class SubscriptionsFuturePeriodStartInvariant(Invariant):
    """
    Invariant that checks if there are any subscriptions with a current_period_start in the future.

    Failure of this invariant indicate there is an issue with the subscription cycle process.
    """

    LIMIT = 10

    async def check(self) -> None:
        statement = (
            select(Subscription.id, over(func.count()))
            .where(
                Subscription.current_period_start > func.now(),
            )
            .limit(self.LIMIT)
            .order_by(Subscription.current_period_start.asc(), Subscription.id.asc())
        )

        result = await self.session.execute(statement)
        results = result.fetchall()
        if len(results) > 0:
            count = results[0][1]
        else:
            count = 0

        if count > 0:
            subscriptions = [row[0] for row in results]
            raise SubscriptionsFuturePeriodStartInvariantError(count, subscriptions)
