from __future__ import annotations

import asyncio
import json
import uuid
from collections import Counter
from collections.abc import Iterable, Sequence
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.exc import IntegrityError
from temporalio.client import Client

from polar.exceptions import PolarError, ResourceNotFound
from polar.models import VoidReducer as Reducer
from polar.models import VoidReducerBucket
from polar.models import VoidReducerDependency as ReducerDependency
from polar.postgres import AsyncReadSession, AsyncSession
from polar.void.temporal import TASK_QUEUE
from polar.void.tinybird import TinybirdApi

from .buckets import BUCKET_SIZE, bucket_start
from .derived import empty_state, evaluate, validate_inputs
from .filter import to_dnf
from .map import compile_map
from .repository import ReducerRepository
from .schemas import ReducerCreate, ReducerRecord
from .workflows import ReducerBucketInput, ReducerBucketWorkflow

MAX_CONCURRENT_BUCKET_TOUCHES = 50


def _clause_value(value: str | int | bool) -> str:
    if isinstance(value, bool):
        return str(value).lower()
    return str(value)


def decode_last_processed_event(raw: str) -> dict[str, object]:
    external_id, timestamp, ingested_at, event_ids = json.loads(raw)
    return {
        "external_id": external_id,
        "timestamp": datetime.fromisoformat(timestamp).replace(tzinfo=UTC).isoformat(),
        "ingested_at": datetime.fromisoformat(ingested_at)
        .replace(tzinfo=UTC)
        .isoformat(),
        "event_ids": event_ids,
    }


class SlugTaken(PolarError):
    def __init__(self) -> None:
        super().__init__("Slug already exists", 409)


class ReducerNotDict(PolarError):
    def __init__(self) -> None:
        super().__init__("Reducer must be dict", 400)


class ReducerService:
    async def list(
        self, session: AsyncReadSession, organization_id: uuid.UUID
    ) -> Sequence[Reducer]:
        return await ReducerRepository.from_session(session).list(organization_id)

    async def get(
        self, session: AsyncReadSession, organization_id: uuid.UUID, id: uuid.UUID
    ) -> Reducer:
        result = await ReducerRepository.from_session(session).get_scoped(
            organization_id, id
        )
        if result is None:
            raise ResourceNotFound()
        return result

    async def create(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        create_schema: ReducerCreate,
    ) -> Reducer:
        repository = ReducerRepository.from_session(session)
        await repository.lock_definitions(organization_id)
        organization = await repository.organization(organization_id)
        if organization is None:
            raise ResourceNotFound()
        sources = {}
        if create_schema.aggregation.func == "derive":
            sources = {r.slug: r for r in await self.list(session, organization_id)}
            validate_inputs(create_schema.aggregation.inputs, sources)
        reducer = Reducer(
            slug=create_schema.slug,
            filter=create_schema.filter,
            aggregation=create_schema.aggregation,
            map=create_schema.map,
            organization=organization,
        )
        try:
            async with session.begin_nested():
                session.add(reducer)
                await session.flush()
                if create_schema.aggregation.func == "derive":
                    for name, slug in create_schema.aggregation.inputs.items():
                        session.add(
                            ReducerDependency(
                                reducer=reducer,
                                input_name=name,
                                source_reducer=sources[slug],
                                organization=organization,
                            )
                        )
                    await session.flush()
                    await repository.rebuild_derived(reducer)
                else:
                    await repository.rebuild_events(reducer)
        except IntegrityError as exc:
            if "void_reducers_organization_id_slug_key" in str(exc.orig):
                raise SlugTaken() from exc
            raise
        return reducer

    async def rebuild_derived(
        self, session: AsyncSession, reducer_id: uuid.UUID
    ) -> None:
        repository = ReducerRepository.from_session(session)
        reducer = await repository.get_active(reducer_id)
        if reducer is None:
            raise ResourceNotFound()
        await repository.rebuild_derived(reducer)

    async def enqueue_dependents(
        self, session: AsyncSession, reducer_id: uuid.UUID, start: datetime
    ) -> None:
        repository = ReducerRepository.from_session(session)
        reducer = await repository.get_active(reducer_id)
        if reducer is None:
            raise ResourceNotFound()
        await repository.enqueue_dependents(reducer, start)

    async def input_sources(
        self, session: AsyncReadSession, reducer_id: uuid.UUID
    ) -> dict[str, Reducer]:
        repository = ReducerRepository.from_session(session)
        reducer = await repository.get_active(reducer_id)
        if reducer is None:
            raise ResourceNotFound()
        return await repository.input_sources(reducer)

    async def recompute_derived(
        self, session: AsyncSession, reducer: Reducer, start: datetime
    ) -> int:
        assert reducer.aggregation.func == "derive"
        repository = ReducerRepository.from_session(session)
        await repository.lock_bucket(reducer.id, start)
        sources = await repository.input_sources(reducer)
        functions = {name: source.aggregation.func for name, source in sources.items()}
        buckets = await repository.input_buckets(reducer, list(sources.values()), start)
        by_actor: dict[str | None, dict[uuid.UUID, VoidReducerBucket]] = {}
        for bucket in buckets:
            by_actor.setdefault(bucket.external_identity_id, {})[bucket.reducer_id] = (
                bucket
            )
        rows = []
        for actor, inputs in by_actor.items():
            state = empty_state(functions)
            root = None
            for name, source in sources.items():
                if (source_bucket := inputs.get(source.id)) is not None:
                    state[name] = source_bucket.value
                    root = source_bucket.external_root_id
            rows.append(
                {
                    "reducer_id": reducer.id,
                    "organization_id": reducer.organization_id,
                    "external_identity_id": actor,
                    "external_root_id": root,
                    "bucket_start": start,
                    "value": evaluate(reducer.aggregation.expression, state),
                    "data": {"inputs": state},
                    "last_processed_event": None,
                }
            )
        await self.write_buckets(session, rows)
        return len(rows)

    async def write_buckets(
        self, session: AsyncSession, rows: Sequence[dict[str, Any]]
    ) -> None:
        await ReducerRepository.from_session(session).write_buckets(rows)

    async def records(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
        id: uuid.UUID,
        external_identity_id: str | None = None,
    ) -> Sequence[ReducerRecord]:
        reducer = await self.get(session, organization_id, id)
        if reducer.aggregation.type != "dict":
            raise ReducerNotDict()
        rows = await ReducerRepository.from_session(session).records(
            reducer, external_identity_id
        )
        return [
            ReducerRecord(external_identity_id=actor, timestamp=start, data=data or {})
            for actor, start, data in rows
        ]

    async def touch_buckets(
        self,
        temporal: Client,
        organization_id: uuid.UUID,
        timestamps: Iterable[datetime],
    ) -> None:
        buckets = Counter(bucket_start(timestamp) for timestamp in timestamps)
        semaphore = asyncio.Semaphore(MAX_CONCURRENT_BUCKET_TOUCHES)

        async def touch(start: datetime, events: int) -> None:
            async with semaphore:
                await temporal.start_workflow(
                    ReducerBucketWorkflow.run,
                    ReducerBucketInput(str(organization_id), start.isoformat()),
                    id=f"polar-void-reducer-bucket-{organization_id}-{start.isoformat()}",
                    task_queue=TASK_QUEUE,
                    start_signal="touch",
                    start_signal_args=[events],
                )

        await asyncio.gather(
            *(touch(start, events) for start, events in buckets.items())
        )

    async def recompute(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        reducer: Reducer,
        start: datetime,
        end: datetime,
    ) -> int:
        if reducer.aggregation.func == "derive":
            count = 0
            while start < end:
                count += await self.recompute_derived(session, reducer, start)
                start += BUCKET_SIZE
            return count
        assert reducer.filter is not None
        repository = ReducerRepository.from_session(session)
        await repository.lock_definitions(reducer.organization_id, shared=True)
        await repository.lock_bucket(reducer.id, start)
        groups = to_dnf(reducer.filter)
        if any(not group for group in groups):
            groups = []
        clauses = [
            (index, clause) for index, group in enumerate(groups) for clause in group
        ]
        result = await asyncio.to_thread(
            tinybird.query,
            "void_reducer_buckets",
            {
                "organization_id": str(reducer.organization_id),
                "start": start.astimezone(UTC).strftime("%Y-%m-%d %H:%M:%S"),
                "end": end.astimezone(UTC).strftime("%Y-%m-%d %H:%M:%S"),
                "func": reducer.aggregation.func,
                "event_map": json.dumps(compile_map(reducer.map)),
                "aggregation_property": getattr(reducer.aggregation, "property", "_"),
                "clause_group": json.dumps([index for index, _ in clauses]),
                "clause_property": json.dumps([c.property for _, c in clauses]),
                "clause_operator": json.dumps([c.operator for _, c in clauses]),
                "clause_value": json.dumps(
                    [_clause_value(c.value) for _, c in clauses]
                ),
            },
        )
        rows = [
            {
                "reducer_id": reducer.id,
                "organization_id": reducer.organization_id,
                "external_identity_id": row["external_identity_id"],
                "external_root_id": row["external_root_id"],
                "bucket_start": datetime.fromisoformat(row["bucket_start"]).replace(
                    tzinfo=UTC
                ),
                "value": row["value"] if reducer.aggregation.type == "scalar" else None,
                "data": json.loads(row["data"]) if row["data"] else None,
                "last_processed_event": decode_last_processed_event(
                    row["last_processed_event"]
                ),
            }
            for row in result["data"]
        ]
        await self.write_buckets(session, rows)
        current = bucket_start(start)
        while current < end:
            await self.enqueue_dependents(session, reducer.id, current)
            current += BUCKET_SIZE
        return len(rows)

    async def recompute_bucket(
        self,
        session: AsyncSession,
        tinybird: TinybirdApi,
        reducer_id: uuid.UUID,
        start: datetime,
        organization_id: uuid.UUID | None = None,
    ) -> int:
        repository = ReducerRepository.from_session(session)
        reducer = (
            await repository.get_scoped(organization_id, reducer_id)
            if organization_id is not None
            else await repository.get_active(reducer_id)
        )
        if reducer is None:
            raise ResourceNotFound()
        return await self.recompute(
            session, tinybird, reducer, start, start + BUCKET_SIZE
        )


reducer = ReducerService()
