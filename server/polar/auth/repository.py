from uuid import UUID

from sqlalchemy import delete

from polar.kit.repository import RepositoryBase, RepositoryTokenHashMixin
from polar.kit.repository.base import RepositoryIDMixin
from polar.kit.utils import utc_now
from polar.models import AuthenticationSession, EmailOTP, UserSession


class EmailOTPRepository(RepositoryBase[EmailOTP], RepositoryIDMixin[EmailOTP, UUID]):
    model = EmailOTP

    async def delete_expired(self) -> None:
        statement = delete(EmailOTP).where(
            EmailOTP.expires_at < int(utc_now().timestamp())
        )
        await self.session.execute(statement)


class AuthenticationSessionRepository(
    RepositoryBase[AuthenticationSession],
    RepositoryIDMixin[AuthenticationSession, UUID],
):
    model = AuthenticationSession

    async def delete_expired(self) -> None:
        statement = delete(AuthenticationSession).where(
            AuthenticationSession.expires_at < int(utc_now().timestamp())
        )
        await self.session.execute(statement)


class UserSessionRepository(
    RepositoryBase[UserSession],
    RepositoryIDMixin[UserSession, UUID],
    RepositoryTokenHashMixin[UserSession],
):
    model = UserSession
    token_hash_attribute = "token"

    async def get_by_token(
        self, token: str, *, expired: bool = False
    ) -> UserSession | None:
        statement = self.get_base_statement().where(self.token_hash_clause(token))
        if not expired:
            statement = statement.where(UserSession.expires_at > utc_now())
        user_session = await self.get_one_or_none(statement)
        if user_session is None:
            return None
        return await self.rehash_token(user_session, token)
