from collections.abc import Callable, Mapping, Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, func, null, select

from polar.kit.repository import RepositoryBase
from polar.models import VoidReducer, VoidReducerBucket, VoidReducerDependency
from polar.void.reducer.derived import merge_state

from .schemas import GroupBy, TimeInterval

SQL_MERGE: dict[str, Callable[..., ColumnElement[Any]]] = {
    "count": func.sum,
    "sum": func.sum,
    "max": func.max,
    "min": func.min,
}
GROUP_COLUMNS = {
    GroupBy.identity: VoidReducerBucket.external_identity_id,
    GroupBy.root: VoidReducerBucket.external_root_id,
}


class MetricRepository(RepositoryBase[VoidReducer]):
    model = VoidReducer

    async def get_reducer(
        self, organization_id: UUID, reducer_id: UUID
    ) -> VoidReducer | None:
        return await self.get_one_or_none(
            select(VoidReducer).where(
                VoidReducer.organization_id == organization_id,
                VoidReducer.id == reducer_id,
                VoidReducer.deleted_at.is_(None),
            )
        )

    async def input_sources(self, reducer: VoidReducer) -> dict[str, VoidReducer]:
        rows = await self.session.execute(
            select(VoidReducerDependency.input_name, VoidReducer)
            .join(
                VoidReducer, VoidReducer.id == VoidReducerDependency.source_reducer_id
            )
            .where(
                VoidReducerDependency.organization_id == reducer.organization_id,
                VoidReducerDependency.reducer_id == reducer.id,
                VoidReducer.organization_id == reducer.organization_id,
                VoidReducer.deleted_at.is_(None),
            )
        )
        return dict(rows.tuples().all())

    def conditions(
        self,
        reducer: VoidReducer,
        end: datetime,
        start: datetime | None,
        root_ids: Sequence[str] | None,
        actor_ids: Sequence[str] | None,
    ) -> list[ColumnElement[bool]]:
        conditions = [
            VoidReducerBucket.organization_id == reducer.organization_id,
            VoidReducerBucket.reducer_id == reducer.id,
            VoidReducerBucket.deleted_at.is_(None),
            VoidReducerBucket.bucket_start < end,
        ]
        if start is not None:
            conditions.append(VoidReducerBucket.bucket_start >= start)
        if root_ids is not None:
            conditions.append(VoidReducerBucket.external_root_id.in_(root_ids))
        if actor_ids is not None:
            conditions.append(VoidReducerBucket.external_identity_id.in_(actor_ids))
        return conditions

    async def rollup(
        self,
        reducer: VoidReducer,
        interval: TimeInterval | None,
        end: datetime,
        start: datetime | None,
        root_ids: Sequence[str] | None,
        actor_ids: Sequence[str] | None,
        group_by: GroupBy | None,
    ) -> dict[tuple[str | None, datetime | None], float | None]:
        group = (GROUP_COLUMNS[group_by] if group_by else null()).label("group")
        period = (
            func.date_trunc(interval.value, VoidReducerBucket.bucket_start, "UTC")
            if interval is not None
            else null()
        ).label("period")
        rows = await self.session.execute(
            select(
                group,
                period,
                SQL_MERGE[reducer.aggregation.func](VoidReducerBucket.value),
            )
            .where(*self.conditions(reducer, end, start, root_ids, actor_ids))
            .group_by(
                *([group] if group_by is not None else []),
                *([period] if interval is not None else []),
            )
        )
        return {(group, period): value for group, period, value in rows}

    async def rollup_derived(
        self,
        reducer: VoidReducer,
        functions: Mapping[str, str],
        interval: TimeInterval | None,
        end: datetime,
        start: datetime | None,
        root_ids: Sequence[str] | None,
        actor_ids: Sequence[str] | None,
        group_by: GroupBy | None,
    ) -> dict[tuple[str | None, datetime | None], dict[str, float | None]]:
        group = (GROUP_COLUMNS[group_by] if group_by else null()).label("group")
        period = (
            func.date_trunc(interval.value, VoidReducerBucket.bucket_start, "UTC")
            if interval is not None
            else null()
        ).label("period")
        columns: list[ColumnElement[Any]] = [
            SQL_MERGE[aggregation](VoidReducerBucket.data["inputs"][name].as_float())
            for name, aggregation in functions.items()
        ]
        rows = await self.session.execute(
            select(group, period, *columns)
            .where(*self.conditions(reducer, end, start, root_ids, actor_ids))
            .group_by(
                *([group] if group_by is not None else []),
                *([period] if interval is not None else []),
            )
        )
        return {
            (row[0], row[1]): merge_state(
                functions, dict(zip(functions, row[2:], strict=True))
            )
            for row in rows
        }
