from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import contains_eager

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
    RepositoryTokenHashMixin,
)
from polar.kit.utils import utc_now
from polar.models import Member, MemberSession
from polar.models.customer import Customer


class MemberSessionRepository(
    RepositorySoftDeletionIDMixin[MemberSession, UUID],
    RepositorySoftDeletionMixin[MemberSession],
    RepositoryTokenHashMixin[MemberSession],
    RepositoryBase[MemberSession],
):
    model = MemberSession
    token_hash_attribute = "token"

    async def get_by_token(
        self, token: str, *, expired: bool = False
    ) -> MemberSession | None:
        statement = (
            select(MemberSession)
            .join(MemberSession.member)
            .join(Member.customer)
            .where(
                self.token_hash_clause(token),
                ~MemberSession.is_deleted,
                ~Member.is_deleted,
                Customer.can_authenticate,
            )
            .options(
                contains_eager(MemberSession.member)
                .contains_eager(Member.customer)
                .joinedload(Customer.organization)
            )
        )
        if not expired:
            statement = statement.where(MemberSession.expires_at > utc_now())

        result = await self.session.execute(statement)
        member_session = result.unique().scalar_one_or_none()
        if member_session is None:
            return None
        return await self.rehash_token(member_session, token)

    async def delete_expired(self) -> None:
        statement = delete(MemberSession).where(MemberSession.expires_at < utc_now())
        await self.session.execute(statement)
