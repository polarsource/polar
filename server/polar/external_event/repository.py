from uuid import UUID

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import ExternalEvent
from polar.models.external_event import ExternalEventSource


class ExternalEventRepository(
    RepositoryBase[ExternalEvent], RepositoryIDMixin[ExternalEvent, UUID]
):
    model = ExternalEvent

    async def get_by_source_and_id(
        self, source: ExternalEventSource, id: UUID
    ) -> ExternalEvent | None:
        statement = self.get_base_statement().where(
            ExternalEvent.source == source, ExternalEvent.id == id
        )
        return await self.get_one_or_none(statement)
