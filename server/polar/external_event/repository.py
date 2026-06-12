from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.dialects.postgresql import insert as pg_insert

from polar.kit.repository import (
    RepositoryBase,
    RepositoryIDMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models.external_event import ExternalEvent, ExternalEventSource

from .sorting import ExternalEventSortProperty


class ExternalEventRepository(
    RepositorySortingMixin[ExternalEvent, ExternalEventSortProperty],
    RepositoryBase[ExternalEvent],
    RepositoryIDMixin[ExternalEvent, UUID],
):
    model = ExternalEvent

    async def get_by_source_and_id(
        self, source: ExternalEventSource, id: UUID
    ) -> ExternalEvent | None:
        statement = self.get_base_statement().where(
            ExternalEvent.source == source, ExternalEvent.id == id
        )
        return await self.get_one_or_none(statement)

    async def get_by_source_and_external_id(
        self, source: ExternalEventSource, external_id: str
    ) -> ExternalEvent | None:
        statement = self.get_base_statement().where(
            ExternalEvent.source == source, ExternalEvent.external_id == external_id
        )
        return await self.get_one_or_none(statement)

    async def create_on_conflict_do_nothing(
        self, object: ExternalEvent
    ) -> tuple[ExternalEvent, bool]:
        # Atomic upsert that closes the TOCTOU race between SELECT and INSERT
        # when the same external event is delivered concurrently to multiple
        # API instances. Returns (event, created) where `created` is True only
        # when this call actually inserted the row.
        column_names = {col.key for col in ExternalEvent.__table__.columns}
        values: dict[str, Any] = {
            key: value for key, value in object.__dict__.items() if key in column_names
        }

        statement = (
            pg_insert(ExternalEvent)
            .values(**values)
            .on_conflict_do_nothing(index_elements=["source", "external_id"])
            .returning(ExternalEvent)
        )
        result = await self.session.execute(statement)
        inserted = result.scalars().first()
        if inserted is not None:
            return inserted, True

        existing = await self.get_by_source_and_external_id(
            object.source, object.external_id
        )
        assert existing is not None, (
            "external_events row missing after on_conflict_do_nothing conflict"
        )
        return existing, False

    async def get_all_unhandled(
        self, older_than: datetime | None = None
    ) -> Sequence[ExternalEvent]:
        statement = self.get_base_statement().where(ExternalEvent.handled_at.is_(None))
        if older_than is not None:
            statement = statement.where(ExternalEvent.created_at < older_than)
        return await self.get_all(statement)

    async def delete_before(self, before: datetime) -> None:
        statement = delete(ExternalEvent).where(
            ExternalEvent.handled_at.is_not(None), ExternalEvent.created_at < before
        )
        await self.session.execute(statement)

    def get_sorting_clause(self, property: ExternalEventSortProperty) -> SortingClause:
        match property:
            case ExternalEventSortProperty.created_at:
                return self.model.created_at
            case ExternalEventSortProperty.handled_at:
                return self.model.handled_at
            case ExternalEventSortProperty.source:
                return self.model.source
            case ExternalEventSortProperty.task_name:
                return self.model.task_name
