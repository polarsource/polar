from collections.abc import Sequence
from typing import cast

import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject
from polar.email.react import render_email_template
from polar.email.schemas import OAuth2LeakedClientEmail, OAuth2LeakedClientProps
from polar.email.sender import enqueue_email
from polar.enums import TokenType
from polar.kit.crypto import generate_token
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import OAuth2Client, User
from polar.postgres import AsyncSession

from ..constants import CLIENT_REGISTRATION_TOKEN_PREFIX, CLIENT_SECRET_PREFIX

log: Logger = structlog.get_logger()


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

    async def get_by_client_id(
        self, session: AsyncSession, client_id: str
    ) -> OAuth2Client | None:
        statement = select(OAuth2Client).where(
            OAuth2Client.client_id == client_id, OAuth2Client.deleted_at.is_(None)
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def revoke_leaked(
        self,
        session: AsyncSession,
        token: str,
        token_type: TokenType,
        *,
        notifier: str,
        url: str | None = None,
    ) -> bool:
        statement = select(OAuth2Client).options(joinedload(OAuth2Client.user))

        if token_type == TokenType.client_secret:
            statement = statement.where(OAuth2Client.client_secret == token)
        elif token_type == TokenType.client_registration_token:
            statement = statement.where(OAuth2Client.registration_access_token == token)
        else:
            raise ValueError(f"Unsupported token type: {token_type}")

        result = await session.execute(statement)
        client = result.unique().scalar_one_or_none()

        if client is None:
            return False

        subject: str
        if token_type == TokenType.client_secret:
            client.client_secret = generate_token(prefix=CLIENT_SECRET_PREFIX)  # pyright: ignore
            subject = (
                "Security Notice - Your Polar OAuth2 Client Secret has been leaked"
            )
        elif token_type == TokenType.client_registration_token:
            client.registration_access_token = generate_token(
                prefix=CLIENT_REGISTRATION_TOKEN_PREFIX
            )
            subject = (
                "Security Notice - "
                "Your Polar OAuth2 Client Registration Token has been leaked"
            )
        session.add(client)

        if client.user is not None:
            email = client.user.email
            body = render_email_template(
                OAuth2LeakedClientEmail(
                    props=OAuth2LeakedClientProps(
                        email=email,
                        token_type=token_type,
                        client_name=cast(str, client.client_name),
                        notifier=notifier,
                        url=url or "",
                    )
                )
            )

            enqueue_email(to_email_addr=email, subject=subject, html_content=body)

        log.info(
            "Revoke leaked OAuth2 client",
            id=client.id,
            token_type=token_type,
            notifier=notifier,
            url=url,
        )

        return True


oauth2_client = OAuth2ClientService(OAuth2Client)
