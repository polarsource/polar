import uuid
from datetime import timedelta

from sqlalchemy import func, over, select

from polar.models import Organization, Subscription

from .base import Invariant, InvariantError


class SubscriptionsCurrentPeriodEndInvariantError(InvariantError):
    """Exception raised when the SubscriptionsCurrentPeriodEndInvariant check fails."""

    def __init__(self, count: int, subscriptions: list[uuid.UUID]) -> None:
        message = f"Found {count} subscriptions with current_period_end in the past."
        super().__init__(
            SubscriptionsCurrentPeriodEndInvariant,
            message,
            {
                "count": count,
                "subscriptions": {
                    "ids": subscriptions,
                    "has_more": count > len(subscriptions),
                },
            },
        )


class SubscriptionsCurrentPeriodEndInvariant(Invariant):
    """
    Invariant that checks if there are any subscriptions with a current_period_end in the past.

    Failure of this invariant indicate there is an issue with the subscription cycle process.
    """

    LEEWAY = timedelta(minutes=10)
    SETTLE_GRACE = timedelta(minutes=5)
    """
    A dunning recovery flips the subscription back to active while current_period_end
    is still days old, so LEEWAY never applies. Every step of the handover writes the
    row: an untouched row is the one that is actually stuck. The trade is that a
    stuck subscription written more often than this would never be reported.
    """

    LIMIT = 10

    async def check(self) -> None:
        last_write = func.coalesce(Subscription.modified_at, Subscription.created_at)
        statement = (
            select(Subscription.id, over(func.count()))
            .join(Subscription.organization)
            .where(
                Subscription.active.is_(True),
                Organization.deleted_at.is_(None),
                Subscription.current_period_end < (func.now() - self.LEEWAY),
                Organization.can_renew_subscriptions.is_(True),
                last_write < (func.now() - self.SETTLE_GRACE),
            )
            .order_by(Subscription.current_period_end.asc(), Subscription.id.asc())
            .limit(self.LIMIT)
        )

        result = await self.session.execute(statement)
        results = result.fetchall()
        if len(results) > 0:
            count = results[0][1]
        else:
            count = 0

        if count > 0:
            subscriptions = [row[0] for row in results]
            raise SubscriptionsCurrentPeriodEndInvariantError(count, subscriptions)
