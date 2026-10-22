from collections.abc import Sequence
from datetime import datetime
from typing import Protocol, Self
from uuid import UUID

from polar.models import BillingInterval, Subscription
from polar.postgres import AsyncSession

from .types import IntervalChangePlan


class BillingIntervalRepository(Protocol):
    session: AsyncSession

    @classmethod
    def from_session(cls, session: AsyncSession) -> Self: ...

    async def get_by_subscription(
        self, organization_id: UUID, subscription_id: UUID
    ) -> Sequence[BillingInterval]:
        """Load the complete stream history, including closed intervals."""
        ...

    async def get_by_customer(
        self, organization_id: UUID, customer_id: UUID, *, cutoff: datetime
    ) -> Sequence[BillingInterval]:
        """Load competing history with retained prices and original subscription starts.

        Include ended/deleted subscriptions and trial/paused rows, without current-price
        or currency filtering. Include starts at the cutoff for recipient selection.
        """
        ...

    async def apply_changes(
        self, subscription: Subscription, changes: IntervalChangePlan
    ) -> tuple[BillingInterval, ...]:
        """Write a prelocked stream's plan without committing or splitting buckets."""
        ...
