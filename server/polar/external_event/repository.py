from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

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

    async def get_all_unhandled(
        self, older_than: datetime | None = None
    ) -> Sequence[ExternalEvent]:
        statement = self.get_base_statement().where(ExternalEvent.handled_at.is_(None))
        if older_than is not None:
            statement = statement.where(ExternalEvent.created_at < older_than)
        return await self.get_all(statement)

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
