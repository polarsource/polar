from uuid import UUID

from sqlalchemy import delete

from polar.kit.crypto import get_token_hash
from polar.kit.repository import RepositoryBase
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
    RepositoryBase[UserSession], RepositoryIDMixin[UserSession, UUID]
):
    model = UserSession

    async def get_by_token(
        self, token: str, *, expired: bool = False
    ) -> UserSession | None:
        statement = self.get_base_statement().where(
            UserSession.token == get_token_hash(token)
        )
        if not expired:
            statement = statement.where(UserSession.expires_at > utc_now())
        return await self.get_one_or_none(statement)
