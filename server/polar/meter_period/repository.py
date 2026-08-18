from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from polar.kit.repository import (
    RepositoryBase,
    RepositoryIDMixin,
)
from polar.kit.repository.base import Options
from polar.models import MeterPeriod, Subscription
from polar.models.meter_period import MeterPeriodStatus


class MeterPeriodRepository(
    RepositoryIDMixin[MeterPeriod, UUID],
    RepositoryBase[MeterPeriod],
):
    model = MeterPeriod

    def get_eager_options(self) -> Options:
        return (
            joinedload(MeterPeriod.meter),
            joinedload(MeterPeriod.product_price),
            joinedload(MeterPeriod.subscription).joinedload(Subscription.customer),
        )

    async def exists_for_subscription(self, subscription_id: UUID) -> bool:
        statement = (
            select(MeterPeriod.id)
            .where(MeterPeriod.subscription_id == subscription_id)
            .limit(1)
        )
        return await self.session.scalar(statement) is not None

    async def get_by_subscription(
        self, subscription_id: UUID, *, options: Options = ()
    ) -> Sequence[MeterPeriod]:
        statement = (
            self.get_base_statement()
            .where(MeterPeriod.subscription_id == subscription_id)
            .options(*options)
            .order_by(MeterPeriod.starts_at.desc())
        )
        return await self.get_all(statement)

    async def get_accruing_by_subscription_and_meter(
        self, subscription_id: UUID, meter_id: UUID, *, options: Options = ()
    ) -> MeterPeriod | None:
        statement = (
            self.get_base_statement()
            .where(
                MeterPeriod.subscription_id == subscription_id,
                MeterPeriod.meter_id == meter_id,
                MeterPeriod.status == MeterPeriodStatus.accruing,
            )
            .options(*options)
        )
        return await self.get_one_or_none(statement)

    async def get_last_settled_by_subscription(
        self, subscription_id: UUID, *, options: Options = ()
    ) -> Sequence[MeterPeriod]:
        ranked = (
            select(
                MeterPeriod.id.label("id"),
                func.row_number()
                .over(
                    partition_by=MeterPeriod.meter_id,
                    order_by=MeterPeriod.ends_at.desc(),
                )
                .label("rank"),
            )
            .where(
                MeterPeriod.subscription_id == subscription_id,
                MeterPeriod.status == MeterPeriodStatus.settled,
            )
            .subquery()
        )
        statement = (
            self.get_base_statement()
            .join(ranked, ranked.c.id == MeterPeriod.id)
            .where(ranked.c.rank == 1)
            .options(*options)
            .order_by(MeterPeriod.starts_at.asc())
        )
        return await self.get_all(statement)

    async def get_accruing_by_subscription(
        self,
        subscription_id: UUID,
        *,
        starts_before: datetime | None = None,
        options: Options = (),
    ) -> Sequence[MeterPeriod]:
        statement = (
            self.get_base_statement()
            .where(
                MeterPeriod.subscription_id == subscription_id,
                MeterPeriod.status == MeterPeriodStatus.accruing,
            )
            .options(*options)
            .order_by(MeterPeriod.starts_at.asc())
        )
        # Usage at a boundary belongs to the next window, so the period opened at the
        # cutoff is not settled by the invoice that closes the previous one.
        if starts_before is not None:
            statement = statement.where(MeterPeriod.starts_at < starts_before)
        return await self.get_all(statement)
