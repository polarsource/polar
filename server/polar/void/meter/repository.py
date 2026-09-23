from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, ColumnElement, Select, func, literal, select
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import selectinload

from polar.kit.repository import RepositoryBase
from polar.models import Event as EventModel
from polar.models import Meter as MeterModel
from polar.models import VoidReducer, VoidReducerBucket
from polar.void.metric.repository import SQL_MERGE


class MeterRepository(RepositoryBase[MeterModel]):
    model = MeterModel

    def get_base_statement(self) -> Select[tuple[MeterModel]]:
        return select(MeterModel).options(selectinload(MeterModel.deployment))

    def scoped_statement(self, organization_id: UUID) -> Select[tuple[MeterModel]]:
        return self.get_base_statement().where(
            MeterModel.organization_id == organization_id,
            MeterModel.deleted_at.is_(None),
            MeterModel.version_id.is_not(None),
        )

    async def list(self, organization_id: UUID) -> Sequence[MeterModel]:
        statement = self.scoped_statement(organization_id)
        return await self.get_all(
            statement.order_by(MeterModel.created_at, MeterModel.id)
        )

    async def get(self, organization_id: UUID, id: UUID) -> MeterModel | None:
        return await self.get_one_or_none(
            self.scoped_statement(organization_id).where(MeterModel.id == id)
        )

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
                    select(EventModel.id)
                    .where(
                        EventModel.organization_id == organization_id,
                        EventModel.delivered_at.is_(None),
                    )
                    .exists()
                )
            )
        )
