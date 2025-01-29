from collections.abc import Sequence
from uuid import UUID

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import Event


class EventRepository(RepositoryBase[Event], RepositoryIDMixin[Event, UUID]):
    model = Event

    async def get_all_by_organization(self, organization_id: UUID) -> Sequence[Event]:
        statement = self.get_base_statement().where(
            Event.organization_id == organization_id
        )
        return await self.get_all(statement)
