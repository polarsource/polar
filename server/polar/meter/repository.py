from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import Meter, UserOrganization


class MeterRepository(RepositoryBase[Meter], RepositoryIDMixin[Meter, UUID]):
    model = Meter

    async def get_readable_by_id(
        self, id: UUID, auth_subject: AuthSubject[User | Organization]
    ) -> Meter | None:
        statement = self.get_readable_statement(auth_subject).where(Meter.id == id)
        return await self.get_one_or_none(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Meter]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Meter.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.is_deleted.is_(False),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Meter.organization_id == auth_subject.subject.id
            )

        return statement
