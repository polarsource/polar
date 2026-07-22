from uuid import UUID

from sqlalchemy import delete

from polar.kit.repository import RepositoryBase
from polar.kit.repository.base import RepositoryIDMixin
from polar.kit.utils import utc_now
from polar.models import AuthenticationSession, EmailOTP


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
