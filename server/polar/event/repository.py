from collections.abc import Sequence
from typing import Any
from uuid import UUID

from sqlalchemy import Select, insert, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import Event, UserOrganization


class EventRepository(RepositoryBase[Event], RepositoryIDMixin[Event, UUID]):
    model = Event

    async def get_all_by_organization(self, organization_id: UUID) -> Sequence[Event]:
        statement = self.get_base_statement().where(
            Event.organization_id == organization_id
        )
        return await self.get_all(statement)

    async def insert_batch(self, events: Sequence[dict[str, Any]]) -> None:
        statement = insert(Event)
        await self.session.execute(statement, events)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Event]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Event.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Event.organization_id == auth_subject.subject.id
            )

        return statement
