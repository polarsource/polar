from collections.abc import Sequence
from uuid import UUID

from polar.kit.repository import RepositoryBase, RepositorySoftDeletionMixin
from polar.models import Subscription
from polar.models.subscription import SubscriptionStatus


class PricingSimulationRepository(
    RepositorySoftDeletionMixin[Subscription], RepositoryBase[Subscription]
):
    model = Subscription

    async def get_subscribers(self, product_ids: set[UUID]) -> Sequence[Subscription]:
        statement = self.get_base_statement().where(
            Subscription.product_id.in_(product_ids),
            Subscription.status.in_(SubscriptionStatus.billable_statuses()),
            Subscription.cancel_at_period_end.is_(False),
        )
        return await self.get_all(statement)
