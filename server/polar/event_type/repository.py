from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, func, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import Event, EventType, UserOrganization
from polar.models.event import EventSource


class EventTypeRepository(
    RepositoryBase[EventType], RepositoryIDMixin[EventType, UUID]
):
    model = EventType

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[EventType]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                EventType.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                EventType.organization_id == auth_subject.subject.id
            )

        return statement

    def get_event_types_with_stats_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[EventType, EventSource, int, datetime, datetime]]:
        return (
            self.get_readable_statement(auth_subject)
            .join(Event, EventType.id == Event.event_type_id)
            .with_only_columns(
                EventType,
                Event.source,
                func.count(Event.id).label("occurrences"),
                func.min(Event.timestamp).label("first_seen"),
                func.max(Event.timestamp).label("last_seen"),
            )
            .group_by(
                EventType.id,
                EventType.created_at,
                EventType.modified_at,
                EventType.deleted_at,
                EventType.name,
                EventType.label,
                EventType.organization_id,
                Event.source,
            )
        )

    async def get_by_name_and_organization(
        self, name: str, organization_id: UUID
    ) -> EventType | None:
        statement = select(EventType).where(
            EventType.name == name,
            EventType.organization_id == organization_id,
            EventType.deleted_at.is_(None),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_or_create(self, name: str, organization_id: UUID) -> EventType:
        existing = await self.get_by_name_and_organization(name, organization_id)
        if existing:
            return existing

        event_type = EventType(name=name, label=name, organization_id=organization_id)
        self.session.add(event_type)
        await self.session.flush()
        return event_type
