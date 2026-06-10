from collections.abc import Sequence
from uuid import UUID

from polar.authz.types import AccessibleOrganizationID
from polar.event.repository import EventRepository
from polar.models import Event
from polar.postgres import AsyncSession


async def get_all_by_name(session: AsyncSession, name: str) -> Sequence[Event]:
    repository = EventRepository.from_session(session)
    statement = repository.get_base_statement().where(Event.name == name)
    return await repository.get_all(statement)


async def get_all_by_organization(
    session: AsyncSession, organization_id: UUID
) -> Sequence[Event]:
    repository = EventRepository.from_session(session)
    statement = repository.get_statement_by_org_ids(
        {AccessibleOrganizationID(organization_id)}
    )
    return await repository.get_all(statement)
