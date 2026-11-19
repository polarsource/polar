from collections.abc import AsyncIterator, Sequence
from contextlib import asynccontextmanager
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select, update

from polar.kit.repository import RepositoryBase
from polar.models import BillingInterval, Customer, Subscription

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

    async def get_by_customer_and_meter(
        self,
        customer: Customer,
        meter_id: UUID,
        *,
        until: datetime,
    ) -> Sequence[BillingInterval]:
        """Intervals of every subscription of the customer starting by `until`."""
        # TODO: No lower bound, so usage an earlier failed seal left unsealed is
        # still split before it's sealed. Once seal failures raise instead of being
        # logged (when the reducer bills for real), nothing before the previous
        # reset can be left unsealed: cap this to intervals ending at or after it.
        statement = (
            self.get_base_statement()
            .join(Subscription, Subscription.id == BillingInterval.subscription_id)
            .where(
                Subscription.customer_id == customer.id,
                BillingInterval.organization_id == customer.organization_id,
                BillingInterval.meter_id == meter_id,
                BillingInterval.period_start <= until,
            )
        )
        return await self.get_all(statement)

    async def get_lock_timeout(self) -> str:
        result = await self.session.execute(
            select(func.current_setting("lock_timeout"))
        )
        return result.scalar_one()

    @asynccontextmanager
    async def local_lock_timeout(self, lock_timeout: str) -> AsyncIterator[None]:
        """Restores the previous value on exit, since releasing a savepoint keeps it."""
        previous = await self.get_lock_timeout()
        await self._set_local_lock_timeout(lock_timeout)
        try:
            yield
        finally:
            await self._set_local_lock_timeout(previous)

    async def _set_local_lock_timeout(self, lock_timeout: str) -> None:
        await self.session.execute(
            select(func.set_config("lock_timeout", lock_timeout, True))
        )

    @asynccontextmanager
    async def local_statement_timeout(
        self, statement_timeout: str
    ) -> AsyncIterator[None]:
        """Restores the previous value on exit, since releasing a savepoint keeps it."""
        previous = await self._get_statement_timeout()
        await self._set_local_statement_timeout(statement_timeout)
        try:
            yield
        finally:
            await self._set_local_statement_timeout(previous)

    async def _get_statement_timeout(self) -> str:
        result = await self.session.execute(
            select(func.current_setting("statement_timeout"))
        )
        return result.scalar_one()

    async def _set_local_statement_timeout(self, statement_timeout: str) -> None:
        await self.session.execute(
            select(func.set_config("statement_timeout", statement_timeout, True))
        )

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
