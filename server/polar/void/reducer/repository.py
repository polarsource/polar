from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from sqlalchemy import Select, Uuid, func, literal, select, text
from sqlalchemy.dialects.postgresql import insert

from polar.kit.repository import RepositoryBase
from polar.kit.utils import utc_now
from polar.models import (
    Event as EventModel,
)
from polar.models import (
    VoidReducer,
    VoidReducerBucket,
    VoidReducerDependency,
    VoidReducerJob,
)

from .buckets import BUCKET_SIZE


class ReducerRepository(RepositoryBase[VoidReducer]):
    model = VoidReducer

    def scoped(self, organization_id: UUID) -> Select[tuple[VoidReducer]]:
        return select(VoidReducer).where(
            VoidReducer.organization_id == organization_id,
            VoidReducer.deleted_at.is_(None),
        )

    async def list(self, organization_id: UUID) -> Sequence[VoidReducer]:
        return await self.get_all(
            self.scoped(organization_id).order_by(
                VoidReducer.created_at, VoidReducer.id
            )
        )

    async def get_scoped(
        self, organization_id: UUID, reducer_id: UUID
    ) -> VoidReducer | None:
        return await self.get_one_or_none(
            self.scoped(organization_id).where(VoidReducer.id == reducer_id)
        )

    async def get_active(self, reducer_id: UUID) -> VoidReducer | None:
        return await self.get_one_or_none(
            select(VoidReducer).where(
                VoidReducer.id == reducer_id, VoidReducer.deleted_at.is_(None)
            )
        )

    async def lock_definitions(
        self, organization_id: UUID, *, shared: bool = False
    ) -> None:
        statement = (
            "SELECT pg_advisory_xact_lock_shared(hashtext(:key))"
            if shared
            else "SELECT pg_advisory_xact_lock(hashtext(:key))"
        )
        await self.session.execute(
            text(statement),
            {"key": f"polar-void-reducer-definitions:{organization_id}"},
        )

    async def lock_bucket(self, reducer_id: UUID, start: datetime) -> None:
        await self.session.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:key))"),
            {"key": f"polar-void-reducer:{reducer_id}:{start.isoformat()}"},
        )

    async def rebuild_derived(self, reducer: VoidReducer) -> None:
        starts = (
            select(
                literal(reducer.id, type_=Uuid),
                literal(reducer.organization_id, type_=Uuid),
                VoidReducerBucket.bucket_start,
            )
            .where(
                VoidReducerBucket.organization_id == reducer.organization_id,
                VoidReducerBucket.reducer_id.in_(
                    select(VoidReducerDependency.source_reducer_id).where(
                        VoidReducerDependency.reducer_id == reducer.id,
                        VoidReducerDependency.organization_id
                        == reducer.organization_id,
                    )
                )
                | (VoidReducerBucket.reducer_id == reducer.id),
            )
            .distinct()
        )
        statement = insert(VoidReducerJob).from_select(
            ["reducer_id", "organization_id", "bucket_start"], starts
        )
        await self.session.execute(
            statement.on_conflict_do_update(
                index_elements=["reducer_id", "bucket_start"],
                set_={"bucket_start": statement.excluded.bucket_start},
            )
        )

    async def rebuild_events(self, reducer: VoidReducer) -> None:
        starts = (
            select(
                literal(reducer.id, type_=Uuid),
                literal(reducer.organization_id, type_=Uuid),
                func.date_bin(
                    BUCKET_SIZE, EventModel.timestamp, datetime(1970, 1, 1, tzinfo=UTC)
                ),
            )
            .where(EventModel.organization_id == reducer.organization_id)
            .distinct()
        )
        statement = insert(VoidReducerJob).from_select(
            ["reducer_id", "organization_id", "bucket_start"], starts
        )
        await self.session.execute(
            statement.on_conflict_do_update(
                index_elements=["reducer_id", "bucket_start"],
                set_={"bucket_start": statement.excluded.bucket_start},
            )
        )

    async def enqueue_dependents(self, reducer: VoidReducer, start: datetime) -> None:
        statement = insert(VoidReducerJob).from_select(
            ["reducer_id", "organization_id", "bucket_start"],
            select(
                VoidReducerDependency.reducer_id,
                VoidReducerDependency.organization_id,
                literal(start),
            )
            .where(
                VoidReducerDependency.source_reducer_id == reducer.id,
                VoidReducerDependency.organization_id == reducer.organization_id,
            )
            .distinct(),
        )
        # Updating waits for an in-flight dispatcher deletion and preserves fresh work.
        await self.session.execute(
            statement.on_conflict_do_update(
                index_elements=["reducer_id", "bucket_start"],
                set_={"bucket_start": statement.excluded.bucket_start},
            )
        )

    async def input_sources(self, reducer: VoidReducer) -> dict[str, VoidReducer]:
        rows = await self.session.execute(
            select(VoidReducerDependency.input_name, VoidReducer)
            .join(
                VoidReducer, VoidReducer.id == VoidReducerDependency.source_reducer_id
            )
            .where(
                VoidReducerDependency.reducer_id == reducer.id,
                VoidReducerDependency.organization_id == reducer.organization_id,
                VoidReducer.organization_id == reducer.organization_id,
                VoidReducer.deleted_at.is_(None),
            )
        )
        return {name: source for name, source in rows}

    async def input_buckets(
        self, reducer: VoidReducer, sources: Sequence[VoidReducer], start: datetime
    ) -> Sequence[VoidReducerBucket]:
        result = await self.session.scalars(
            select(VoidReducerBucket).where(
                VoidReducerBucket.organization_id == reducer.organization_id,
                VoidReducerBucket.reducer_id.in_(
                    [reducer.id, *(source.id for source in sources)]
                ),
                VoidReducerBucket.bucket_start == start,
                VoidReducerBucket.deleted_at.is_(None),
            )
        )
        return result.all()

    async def write_buckets(self, rows: Sequence[dict[str, Any]]) -> None:
        if rows:
            statement = insert(VoidReducerBucket).values(rows)
            await self.session.execute(
                statement.on_conflict_do_update(
                    index_elements=[
                        "reducer_id",
                        "external_identity_id",
                        "bucket_start",
                    ],
                    set_={
                        **{
                            key: getattr(statement.excluded, key)
                            for key in (
                                "external_root_id",
                                "value",
                                "data",
                                "last_processed_event",
                            )
                        },
                        "modified_at": utc_now(),
                    },
                )
            )

    async def records(
        self, reducer: VoidReducer, external_identity_id: str | None
    ) -> Sequence[tuple[str | None, datetime, dict[str, Any] | None]]:
        order = (
            VoidReducerBucket.bucket_start.asc()
            if reducer.aggregation.func == "first"
            else VoidReducerBucket.bucket_start.desc()
        )
        statement = (
            select(
                VoidReducerBucket.external_identity_id,
                VoidReducerBucket.bucket_start,
                VoidReducerBucket.data,
            )
            .distinct(VoidReducerBucket.external_identity_id)
            .where(
                VoidReducerBucket.reducer_id == reducer.id,
                VoidReducerBucket.organization_id == reducer.organization_id,
                VoidReducerBucket.deleted_at.is_(None),
            )
            .order_by(VoidReducerBucket.external_identity_id, order)
        )
        if external_identity_id is not None:
            statement = statement.where(
                VoidReducerBucket.external_identity_id == external_identity_id
            )
        result = await self.session.execute(statement)
        return [(actor, start, data) for actor, start, data in result]

    async def event_reducer_ids(self, organization_id: UUID) -> Sequence[UUID]:
        result = await self.session.scalars(
            self.scoped(organization_id)
            .with_only_columns(VoidReducer.id)
            .where(VoidReducer.aggregation["func"].astext != "derive")
        )
        return result.all()

    async def pending_jobs(
        self, organization_ids: set[UUID]
    ) -> Sequence[VoidReducerJob]:
        result = await self.session.scalars(
            select(VoidReducerJob)
            .where(VoidReducerJob.organization_id.in_(organization_ids))
            .order_by(VoidReducerJob.bucket_start, VoidReducerJob.reducer_id)
            .limit(50)
            .with_for_update(skip_locked=True)
        )
        return result.all()
