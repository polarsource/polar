from uuid import UUID

from sqlalchemy import Select, select

from polar.auth.models import AuthSubject, User, is_organization, is_user
from polar.exceptions import NotPermitted
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Audit, Organization, UserOrganization


class AuditRepository(
    RepositorySoftDeletionIDMixin[Audit, UUID],
    RepositorySoftDeletionMixin[Audit],
    RepositoryBase[Audit],
):
    model = Audit

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Audit]]:
        statement = self.get_base_statement()

        if is_user(auth_subject):
            user = auth_subject.subject
            return statement.where(
                Audit.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.is_deleted.is_(False),
                    )
                )
            )
        elif is_organization(auth_subject):
            return statement.where(
                Audit.organization_id == auth_subject.subject.id,
            )

        raise NotPermitted("Invalid auth subject type")
