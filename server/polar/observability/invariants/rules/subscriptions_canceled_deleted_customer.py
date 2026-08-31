import uuid
from collections.abc import Sequence

from sqlalchemy import and_, select

from polar.models import Customer, Subscription

from .base import Invariant, InvariantError


class SubscriptionsCanceledDeletedCustomerInvariantError(InvariantError):
    """Exception raised when the SubscriptionsCanceledDeletedCustomerInvariant check fails."""

    def __init__(self, count: int, subscriptions: Sequence[uuid.UUID]) -> None:
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
                    "has_more": count
                    == SubscriptionsCanceledDeletedCustomerInvariant.LIMIT,
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
            select(Subscription.id)
            .join(Customer, Subscription.customer_id == Customer.id)
            .where(
                and_(
                    Customer.deleted_at.is_not(None),
                    Subscription.active,
                )
            )
            .limit(self.LIMIT)
            .order_by(Customer.deleted_at.asc(), Subscription.id.asc())
        )

        result = await self.session.execute(statement)
        subscriptions = result.scalars().all()
        if subscriptions:
            raise SubscriptionsCanceledDeletedCustomerInvariantError(
                len(subscriptions), subscriptions
            )
