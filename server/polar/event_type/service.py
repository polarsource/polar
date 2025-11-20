from uuid import UUID

from polar.auth.models import AuthSubject
from polar.event_type.repository import EventTypeRepository
from polar.models import EventType, Organization, User
from polar.postgres import AsyncSession


class EventTypeService:
    async def get(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        id: UUID,
    ) -> EventType | None:
        repository = EventTypeRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            EventType.id == id
        )
        return await repository.get_one_or_none(statement)

    async def update(
        self,
        session: AsyncSession,
        event_type: EventType,
        label: str,
    ) -> EventType:
        event_type.label = label
        session.add(event_type)
        return event_type


event_type_service = EventTypeService()
