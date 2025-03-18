from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositoryIDMixin,
    RepositorySortingMixin,
    SortingClause,
)
from polar.models import ExternalEvent
from polar.models.external_event import ExternalEventSource

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
