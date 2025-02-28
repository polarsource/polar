from collections.abc import Sequence
from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Subscription


class SubscriptionRepository(
    RepositorySoftDeletionIDMixin[Subscription, UUID],
    RepositorySoftDeletionMixin[Subscription],
    RepositoryBase[Subscription],
):
    model = Subscription

    async def list_active_by_customer(
        self, customer_id: UUID
    ) -> Sequence[Subscription]:
        statement = self.get_base_statement().where(
            Subscription.customer_id == customer_id,
            Subscription.active.is_(True),
        )
        return await self.get_all(statement)
