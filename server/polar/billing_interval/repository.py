from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import update

from polar.kit.repository import RepositoryBase
from polar.models import BillingInterval, Subscription

from .types import IntervalChangePlan


class BillingIntervalRepository(RepositoryBase[BillingInterval]):
    model = BillingInterval

    async def get_by_subscription(
        self, subscription_id: UUID
    ) -> Sequence[BillingInterval]:
        statement = self.get_base_statement().where(
            BillingInterval.subscription_id == subscription_id
        )
        return await self.get_all(statement)

    async def apply_changes(
        self, subscription: Subscription, changes: IntervalChangePlan
    ) -> None:
        if changes.close_interval_ids:
            await self.session.execute(
                update(BillingInterval)
                .where(BillingInterval.id.in_(changes.close_interval_ids))
                .values(period_end=changes.effective_at)
            )
        for state in changes.new_interval_states:
            await self.create(
                BillingInterval(
                    organization_id=subscription.organization_id,
                    subscription=subscription,
                    customer_id=subscription.customer_id,
                    meter_id=state.meter_id,
                    product_price_id=state.product_price_id,
                    period_start=changes.effective_at,
                    usage_policy=state.usage_policy,
                ),
                flush=True,
            )
