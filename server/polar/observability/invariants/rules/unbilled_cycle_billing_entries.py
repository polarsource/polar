import uuid
from datetime import timedelta

from sqlalchemy import func, over, select

from polar.models import BillingEntry, Organization, Subscription
from polar.models.billing_entry import BillingEntryType
from polar.models.subscription import SubscriptionStatus

from .base import Invariant, InvariantError


class UnbilledCycleBillingEntriesInvariantError(InvariantError):
    """Exception raised when the UnbilledCycleBillingEntriesInvariant check fails."""

    def __init__(self, count: int, subscriptions: list[uuid.UUID]) -> None:
        message = (
            f"Found {count} cycle billing entries not attached to an order item. "
            "The subscription cycled but its order was never created."
        )
        super().__init__(
            UnbilledCycleBillingEntriesInvariant,
            message,
            {
                "count": count,
                "subscriptions": {
                    "ids": subscriptions,
                    "has_more": count > len(subscriptions),
                },
            },
        )


class UnbilledCycleBillingEntriesInvariant(Invariant):
    """
    Invariant that checks if there are any cycle billing entries never attached to an order item.

    Failure of this invariant indicate there is an issue with the subscription cycle process.
    """

    LEEWAY = timedelta(hours=6)
    LIMIT = 10

    async def check(self) -> None:
        statement = (
            select(BillingEntry.subscription_id, over(func.count()))
            .join(BillingEntry.subscription)
            .join(Subscription.organization)
            .where(
                BillingEntry.deleted_at.is_(None),
                BillingEntry.type == BillingEntryType.cycle,
                BillingEntry.order_item_id.is_(None),
                BillingEntry.created_at < (func.now() - self.LEEWAY),
                Subscription.deleted_at.is_(None),
                Subscription.status != SubscriptionStatus.canceled,
                Organization.deleted_at.is_(None),
            )
            .limit(self.LIMIT)
            .order_by(BillingEntry.created_at.asc(), BillingEntry.subscription_id.asc())
        )

        result = await self.session.execute(statement)
        results = result.fetchall()
        if len(results) > 0:
            count = results[0][1]
        else:
            count = 0

        if count > 0:
            subscriptions = [row[0] for row in results]
            raise UnbilledCycleBillingEntriesInvariantError(count, subscriptions)
