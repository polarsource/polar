from collections.abc import Sequence

from sqlalchemy import select

from polar.auth.models import AuthSubject
from polar.exceptions import PolarError
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.models import OAuth2Client, User
from polar.postgres import AsyncSession


class OAuth2ClientError(PolarError): ...


class OAuth2ClientService(ResourceServiceReader[OAuth2Client]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[OAuth2Client], int]:
        statement = (
            select(OAuth2Client)
            .where(
                OAuth2Client.user_id == auth_subject.subject.id,
                OAuth2Client.deleted_at.is_(None),
            )
            .order_by(OAuth2Client.created_at.desc())
        )
        return await paginate(session, statement, pagination=pagination)


oauth2_client = OAuth2ClientService(OAuth2Client)
