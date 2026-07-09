import uuid

from sqlalchemy import and_, func, over, select

from polar.models import Customer, Subscription
from polar.models.subscription import SubscriptionStatus

from .base import Invariant, InvariantError


class SubscriptionsCanceledDeletedCustomerInvariantError(InvariantError):
    """Exception raised when the SubscriptionsCanceledDeletedCustomerInvariant check fails."""

    def __init__(self, count: int, subscriptions: list[uuid.UUID]) -> None:
        message = (
            f"Found {count} subscriptions with active status for deleted customers."
        )
        super().__init__(
            SubscriptionsCanceledDeletedCustomerInvariant,
            message,
            {
                "count": count,
                "subscriptions": {
                    "ids": subscriptions,
                    "has_more": count > len(subscriptions),
                },
            },
        )


class SubscriptionsCanceledDeletedCustomerInvariant(Invariant):
    """
    Invariant that checks if there are any active subscriptions for soft-deleted customers.

    Failure of this invariant indicate there is an issue with the subscription management.
    """

    LIMIT = 10

    async def check(self) -> None:
        statement = (
            select(Subscription.id, over(func.count()))
            .join(Customer, Subscription.customer_id == Customer.id)
            .where(
                and_(
                    Customer.deleted_at.is_not(None),
                    Subscription.active.is_(True),
                )
            )
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
            raise SubscriptionsCanceledDeletedCustomerInvariantError(
                count, subscriptions
            )
