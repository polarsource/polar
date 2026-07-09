from datetime import timedelta

from sqlalchemy import func, select

from polar.models import Organization, Subscription

from .base import Invariant, InvariantError


class SubscriptionsCurrentPeriodEndInvariantError(InvariantError):
    """Exception raised when the SubscriptionsCurrentPeriodEndInvariant check fails."""

    def __init__(self, count: int) -> None:
        message = f"Found {count} subscriptions with current_period_end in the past."
        super().__init__(SubscriptionsCurrentPeriodEndInvariant, message)
        self.count = count


class SubscriptionsCurrentPeriodEndInvariant(Invariant):
    """
    Invariant that checks if there are any subscriptions with a current_period_end in the past.

    Failure of this invariant indicate there is an issue with the subscription cycle process.
    """

    LEEWAY = timedelta(minutes=5)

    async def check(self) -> None:
        statement = (
            select(func.count(Subscription.id))
            .join(Subscription.organization)
            .where(
                Subscription.active.is_(True),
                Subscription.current_period_end < (func.now() - self.LEEWAY),
                Organization.can_renew_subscriptions.is_(True),
            )
        )

        result = await self.session.execute(statement)
        count = result.scalar_one()

        if count > 0:
            raise SubscriptionsCurrentPeriodEndInvariantError(count)
