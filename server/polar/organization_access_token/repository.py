from datetime import datetime
from uuid import UUID

from sqlalchemy import Select, or_, select, update
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, User
from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.kit.utils import utc_now
from polar.models import OrganizationAccessToken, UserOrganization


class OrganizationAccessTokenRepository(
    RepositorySoftDeletionIDMixin[OrganizationAccessToken, UUID],
    RepositorySoftDeletionMixin[OrganizationAccessToken],
    RepositoryBase[OrganizationAccessToken],
):
    model = OrganizationAccessToken

    async def get_by_token_hash(
        self, token_hash: str, *, expired: bool = False
    ) -> OrganizationAccessToken | None:
        statement = (
            self.get_base_statement()
            .where(OrganizationAccessToken.token == token_hash)
            .options(joinedload(OrganizationAccessToken.organization))
        )
        if not expired:
            statement = statement.where(
                or_(
                    OrganizationAccessToken.expires_at.is_(None),
                    OrganizationAccessToken.expires_at > utc_now(),
                )
            )
        return await self.get_one_or_none(statement)

    async def record_usage(self, id: UUID, last_used_at: datetime) -> None:
        statement = (
            update(OrganizationAccessToken)
            .where(OrganizationAccessToken.id == id)
            .values(last_used_at=last_used_at)
        )
        await self.session.execute(statement)

    def get_readable_statement(
        self, auth_subject: AuthSubject[User]
    ) -> Select[tuple[OrganizationAccessToken]]:
        statement = self.get_base_statement()
        user = auth_subject.subject
        statement = statement.where(
            OrganizationAccessToken.organization_id.in_(
                select(UserOrganization.organization_id).where(
                    UserOrganization.user_id == user.id,
                    UserOrganization.deleted_at.is_(None),
                )
            )
        )
        return statement
