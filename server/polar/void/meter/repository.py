from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, ColumnElement, Select, func, literal, select
from sqlalchemy.dialects.postgresql import ARRAY

from polar.kit.repository import RepositoryBase
from polar.models import VoidEvent, VoidMeter, VoidReducer, VoidReducerBucket
from polar.void.metric.repository import SQL_MERGE


class MeterRepository(RepositoryBase[VoidMeter]):
    model = VoidMeter

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[VoidMeter]]:
        return self.get_base_statement().where(
            VoidMeter.organization_id == organization_id,
            VoidMeter.deleted_at.is_(None),
        )

    async def list(self, organization_id: UUID) -> Sequence[VoidMeter]:
        statement = self.scoped_statement(organization_id)
        return await self.get_all(
            statement.order_by(VoidMeter.created_at, VoidMeter.id)
        )

    async def get(self, organization_id: UUID, id: UUID) -> VoidMeter | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(VoidMeter.id == id)
        )

    async def next_generation(
        self,
        organization_id: UUID,
        slug: str,
        variant_id: str | None,
        branch_id: UUID | None,
    ) -> int:
        value = await self.session.scalar(
            select(func.coalesce(func.max(VoidMeter.generation_id), 0) + 1).where(
                VoidMeter.organization_id == organization_id,
                VoidMeter.slug == slug,
                VoidMeter.variant_id.is_not_distinct_from(variant_id),
                VoidMeter.branch_id.is_not_distinct_from(branch_id),
            )
        )
        assert value is not None
        return value

    async def reducer_values(
        self,
        reducer: VoidReducer,
        condition: ColumnElement[bool],
        edges: Sequence[datetime],
        start: datetime,
        end: datetime,
    ) -> Sequence[tuple[datetime, float]]:
        segment = func.width_bucket(
            VoidReducerBucket.bucket_start,
            literal(list(edges), ARRAY(TIMESTAMP(timezone=True))),
        )
        rows = await self.session.execute(
            select(
                segment, SQL_MERGE[reducer.aggregation.func](VoidReducerBucket.value)
            )
            .where(
                VoidReducerBucket.organization_id == reducer.organization_id,
                VoidReducerBucket.reducer_id == reducer.id,
                VoidReducerBucket.deleted_at.is_(None),
                VoidReducerBucket.bucket_start >= start,
                VoidReducerBucket.bucket_start < end,
                condition,
            )
            .group_by(segment)
        )
        return sorted(
            (edges[index - 1] if index else start, value or 0) for index, value in rows
        )

    async def has_pending_events(self, organization_id: UUID) -> bool:
        return bool(
            await self.session.scalar(
                select(
                    select(VoidEvent.id)
                    .where(
                        VoidEvent.organization_id == organization_id,
                        VoidEvent.delivered_at.is_(None),
                    )
                    .exists()
                )
            )
        )
