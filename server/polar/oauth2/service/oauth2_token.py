import time
from typing import cast

import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.email.react import render_email_template
from polar.email.schemas import OAuth2LeakedTokenEmail, OAuth2LeakedTokenProps
from polar.email.sender import enqueue_email
from polar.enums import TokenType
from polar.kit.crypto import get_token_hash
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import OAuth2Token, User
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

log: Logger = structlog.get_logger()


class OAuth2TokenService(ResourceServiceReader[OAuth2Token]):
    async def get_by_access_token(
        self, session: AsyncSession, access_token: str
    ) -> OAuth2Token | None:
        access_token_hash = get_token_hash(access_token, secret=settings.SECRET)
        statement = (
            select(OAuth2Token)
            .where(OAuth2Token.access_token == access_token_hash)
            .options(joinedload(OAuth2Token.client))
        )
        result = await session.execute(statement)
        token = result.unique().scalar_one_or_none()

        if token is None:
            return None

        if cast(bool, token.is_revoked()):
            return None

        if not token.sub.can_authenticate:
            return None

        return token

    async def revoke_leaked(
        self,
        session: AsyncSession,
        token: str,
        token_type: TokenType,
        *,
        notifier: str,
        url: str | None = None,
    ) -> bool:
        statement = select(OAuth2Token).options(
            joinedload(OAuth2Token.user),
            joinedload(OAuth2Token.organization),
            joinedload(OAuth2Token.client),
        )

        if token_type == TokenType.access_token:
            statement = statement.where(
                OAuth2Token.access_token
                == get_token_hash(token, secret=settings.SECRET)
            )
        elif token_type == TokenType.refresh_token:
            statement = statement.where(
                OAuth2Token.refresh_token
                == get_token_hash(token, secret=settings.SECRET)
            )
        else:
            raise ValueError(f"Unsupported token type: {token_type}")

        result = await session.execute(statement)
        oauth2_token = result.unique().scalar_one_or_none()

        if oauth2_token is None:
            return False

        if cast(bool, oauth2_token.is_revoked()):
            return True

        # Revoke
        oauth2_token.access_token_revoked_at = int(time.time())  # pyright: ignore
        oauth2_token.refresh_token_revoked_at = int(time.time())  # pyright: ignore
        session.add(oauth2_token)

        # Notify
        recipients: list[str]
        sub = oauth2_token.sub
        if isinstance(sub, User):
            recipients = [sub.email]
        else:
            members = await user_organization_service.list_by_org(session, sub.id)
            recipients = [member.user.email for member in members]

        oauth2_client = oauth2_token.client

        for recipient in recipients:
            body = render_email_template(
                OAuth2LeakedTokenEmail(
                    props=OAuth2LeakedTokenProps(
                        email=recipient,
                        client_name=cast(str, oauth2_client.client_name),
                        notifier=notifier,
                        url=url or "",
                    )
                )
            )
            enqueue_email(
                to_email_addr=recipient,
                subject="Security Notice - Your Polar Access Token has been leaked",
                html_content=body,
            )

        log.info(
            "Revoke leaked access token and refresh token",
            id=oauth2_token.id,
            token_type=token_type,
            notifier=notifier,
            url=url,
        )

        return True


oauth2_token = OAuth2TokenService(OAuth2Token)
