from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.exc import IntegrityError

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import EventType, UserOrganization


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
                        UserOrganization.is_deleted.is_(False),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                EventType.organization_id == auth_subject.subject.id
            )

        return statement

    async def get_by_name_and_organization(
        self, name: str, organization_id: UUID
    ) -> EventType | None:
        statement = select(EventType).where(
            EventType.name == name,
            EventType.organization_id == organization_id,
            EventType.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_names_and_organization(
        self, names: list[str], organization_id: UUID | Sequence[UUID]
    ) -> dict[tuple[UUID, str], EventType]:
        if not names:
            return {}
        org_filter = (
            EventType.organization_id.in_(organization_id)
            if isinstance(organization_id, Sequence)
            else EventType.organization_id == organization_id
        )
        statement = select(EventType).where(
            EventType.name.in_(names),
            org_filter,
            EventType.is_deleted.is_(False),
        )
        result = await self.session.execute(statement)
        return {(et.organization_id, et.name): et for et in result.scalars().all()}

    async def get_readable_organization_ids(
        self,
        auth_subject: AuthSubject[User | Organization],
        organization_id: Sequence[UUID] | None,
    ) -> Sequence[UUID]:
        if is_organization(auth_subject):
            if (
                organization_id is not None
                and auth_subject.subject.id not in organization_id
            ):
                return []
            return [auth_subject.subject.id]

        statement = select(UserOrganization.organization_id).where(
            UserOrganization.user_id == auth_subject.subject.id,
            UserOrganization.is_deleted.is_(False),
        )
        if organization_id is not None:
            statement = statement.where(
                UserOrganization.organization_id.in_(organization_id)
            )

        result = await self.session.execute(statement)
        return list(dict.fromkeys(result.scalars().all()))

    async def get_or_create(self, name: str, organization_id: UUID) -> EventType:
        existing = await self.get_by_name_and_organization(name, organization_id)
        if existing:
            return existing

        event_type = EventType(name=name, label=name, organization_id=organization_id)
        nested = await self.session.begin_nested()
        try:
            self.session.add(event_type)
            await self.session.flush()
        except IntegrityError:
            await nested.rollback()
            existing = await self.get_by_name_and_organization(name, organization_id)
            if existing:
                return existing
            raise
        return event_type
