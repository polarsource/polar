from collections.abc import Sequence

from sqlalchemy import select

from polar.auth.models import AuthSubject
from polar.enums import TokenType
from polar.exceptions import PolarError
from polar.kit.crypto import generate_token
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.models import OAuth2Client, User
from polar.postgres import AsyncSession

from ..constants import CLIENT_REGISTRATION_TOKEN_PREFIX, CLIENT_SECRET_PREFIX


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

    async def revoke_leaked(
        self, session: AsyncSession, token: str, token_type: TokenType
    ) -> bool:
        statement = select(OAuth2Client)

        if token_type == TokenType.client_secret:
            statement = statement.where(OAuth2Client.client_secret == token)
        elif token_type == TokenType.client_registration_token:
            statement = statement.where(OAuth2Client.registration_access_token == token)
        else:
            raise ValueError(f"Unsupported token type: {token_type}")

        result = await session.execute(statement)
        client = result.scalar_one_or_none()

        if client is not None:
            if token_type == TokenType.client_secret:
                client.client_secret = generate_token(prefix=CLIENT_SECRET_PREFIX)  # type: ignore
            elif token_type == TokenType.client_registration_token:
                client.registration_access_token = generate_token(
                    prefix=CLIENT_REGISTRATION_TOKEN_PREFIX
                )
            session.add(client)

            # TODO: notify user
            return True

        return False


oauth2_client = OAuth2ClientService(OAuth2Client)
