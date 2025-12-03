from uuid import UUID

from sqlalchemy import Select, select
from sqlalchemy.orm import contains_eager

from polar.auth.models import AuthSubject, Organization, User, is_organization, is_user
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Dispute, Payment, UserOrganization


class DisputeRepository(
    RepositorySoftDeletionIDMixin[Dispute, UUID],
    RepositorySoftDeletionMixin[Dispute],
    RepositoryBase[Dispute],
):
    model = Dispute

    def get_readable_statement(
        self, auth_subject: AuthSubject[User | Organization]
    ) -> Select[tuple[Dispute]]:
        statement = (
            self.get_base_statement()
            .join(Dispute.payment)
            .options(contains_eager(Dispute.payment))
        )

        if is_user(auth_subject):
            user = auth_subject.subject
            statement = statement.where(
                Payment.organization_id.in_(
                    select(UserOrganization.organization_id).where(
                        UserOrganization.user_id == user.id,
                        UserOrganization.deleted_at.is_(None),
                    )
                )
            )
        elif is_organization(auth_subject):
            statement = statement.where(
                Payment.organization_id == auth_subject.subject.id
            )

        return statement
