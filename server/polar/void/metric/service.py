import uuid
from collections.abc import Callable, Iterable, Sequence
from datetime import UTC, datetime, timedelta

from polar.exceptions import PolarError, ResourceNotFound
from polar.models import VoidReducer
from polar.postgres import AsyncReadSession
from polar.void.identity.service import identity as identity_service
from polar.void.reducer.derived import empty_state, evaluate, merge_state

from .repository import MetricRepository
from .schemas import (
    GroupBy,
    MetricPeriod,
    Metrics,
    MetricSeries,
    MetricsQuery,
    TimeInterval,
)

MERGE: dict[str, Callable[[Iterable[float]], float]] = {
    "count": sum,
    "sum": sum,
    "max": max,
    "min": min,
}


class ReducerNotScalar(PolarError):
    def __init__(self) -> None:
        super().__init__("Metrics require a scalar reducer.", 400)


def truncate(timestamp: datetime, interval: TimeInterval) -> datetime:
    timestamp = timestamp.astimezone(UTC).replace(minute=0, second=0, microsecond=0)
    if interval == TimeInterval.hour:
        return timestamp
    timestamp = timestamp.replace(hour=0)
    if interval == TimeInterval.day:
        return timestamp
    if interval == TimeInterval.week:
        return timestamp - timedelta(days=timestamp.weekday())
    timestamp = timestamp.replace(day=1)
    if interval == TimeInterval.month:
        return timestamp
    return timestamp.replace(month=1)


def advance(timestamp: datetime, interval: TimeInterval) -> datetime:
    if interval == TimeInterval.hour:
        return timestamp + timedelta(hours=1)
    if interval == TimeInterval.day:
        return timestamp + timedelta(days=1)
    if interval == TimeInterval.week:
        return timestamp + timedelta(weeks=1)
    if interval == TimeInterval.month:
        year, month = divmod(timestamp.month, 12)
        return timestamp.replace(year=timestamp.year + year, month=month + 1)
    return timestamp.replace(year=timestamp.year + 1)


def periods(start: datetime, end: datetime, interval: TimeInterval) -> list[datetime]:
    result = []
    current = truncate(start, interval)
    while current < end:
        result.append(current)
        current = advance(current, interval)
    return result


class MetricService:
    async def identity_scope(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        query: MetricsQuery,
        root_ids: Sequence[str] | None,
    ) -> tuple[Sequence[str] | None, Sequence[str] | None]:
        if query.external_identity_id is None:
            return root_ids, None
        node = await identity_service.get(
            session, organization_id, query.external_identity_id
        )
        await identity_service.chain(session, node)
        if node.is_root:
            roots = (
                [node.external_id]
                if root_ids is None or node.external_id in root_ids
                else []
            )
            return roots, None
        subtree = await identity_service.subtree(session, node)
        return root_ids, [member.external_id for member in subtree]

    async def get(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        query: MetricsQuery,
        *,
        root_ids: Sequence[str] | None = None,
    ) -> Metrics:
        repository = MetricRepository.from_session(session)
        reducer = await repository.get_reducer(organization_id, query.reducer_id)
        if reducer is None:
            raise ResourceNotFound("Reducer not found.")
        if reducer.aggregation.type != "scalar":
            raise ReducerNotScalar()
        if reducer.aggregation.func == "derive":
            return await self.derived(session, reducer, query, root_ids=root_ids)
        merge = MERGE[reducer.aggregation.func]
        start = truncate(query.start, query.interval)
        root_ids, actor_ids = await self.identity_scope(
            session, organization_id, query, root_ids
        )
        values = await repository.rollup(
            reducer,
            query.interval,
            query.end,
            start,
            root_ids,
            actor_ids,
            query.group_by,
        )
        base: dict[str | None, float | None] = {}
        if query.cumulative:
            base = {
                c: v
                for (c, _), v in (
                    await repository.rollup(
                        reducer, None, start, None, root_ids, actor_ids, query.group_by
                    )
                ).items()
            }

        groups = sorted(
            {c for c, _ in values} | set(base), key=lambda c: (c is None, c)
        )
        series = []
        for c in groups or [None]:
            running = base.get(c)
            points = []
            for p in periods(start, query.end, query.interval):
                value = values.get((c, p))
                if query.cumulative:
                    present = [v for v in (running, value) if v is not None]
                    running = merge(present) if present else None
                    value = running
                points.append(MetricPeriod(timestamp=p, value=value or 0))
            present_values = [
                value
                for (group, _), value in values.items()
                if group == c and value is not None
            ]
            if query.cumulative and points:
                total = points[-1].value
            else:
                total = merge(present_values) if present_values else 0
            series.append(
                MetricSeries(
                    external_identity_id=c
                    if query.group_by == GroupBy.identity
                    else None,
                    external_root_id=c if query.group_by == GroupBy.root else None,
                    periods=points,
                    total=total,
                )
            )
        return Metrics(reducer_id=reducer.id, interval=query.interval, series=series)

    async def derived(
        self,
        session: AsyncReadSession,
        reducer: VoidReducer,
        query: MetricsQuery,
        *,
        root_ids: Sequence[str] | None = None,
    ) -> Metrics:
        repository = MetricRepository.from_session(session)
        sources = await repository.input_sources(reducer)
        assert reducer.aggregation.func == "derive"
        functions = {name: source.aggregation.func for name, source in sources.items()}
        expression = reducer.aggregation.expression
        start = truncate(query.start, query.interval)
        root_ids, actor_ids = await self.identity_scope(
            session, reducer.organization_id, query, root_ids
        )
        values = await repository.rollup_derived(
            reducer,
            functions,
            query.interval,
            query.end,
            start,
            root_ids,
            actor_ids,
            query.group_by,
        )
        base = (
            await repository.rollup_derived(
                reducer,
                functions,
                None,
                start,
                None,
                root_ids,
                actor_ids,
                query.group_by,
            )
            if query.cumulative
            else {}
        )
        groups = sorted(
            {c for c, _ in values} | {c for c, _ in base}, key=lambda c: (c is None, c)
        )
        series = []
        for group in groups or [None]:
            running = base.get((group, None), empty_state(functions))
            total = empty_state(functions)
            points = []
            for p in periods(start, query.end, query.interval):
                state = values.get((group, p), empty_state(functions))
                total = merge_state(functions, total, state)
                running = merge_state(functions, running, state)
                points.append(
                    MetricPeriod(
                        timestamp=p,
                        value=evaluate(
                            expression, running if query.cumulative else state
                        ),
                    )
                )
            series.append(
                MetricSeries(
                    external_identity_id=group
                    if query.group_by == GroupBy.identity
                    else None,
                    external_root_id=group if query.group_by == GroupBy.root else None,
                    periods=points,
                    total=evaluate(expression, running if query.cumulative else total),
                )
            )
        return Metrics(reducer_id=reducer.id, interval=query.interval, series=series)


metric = MetricService()
