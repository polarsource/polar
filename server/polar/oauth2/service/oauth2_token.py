import datetime
import time
from typing import cast

import structlog
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.email.renderer import get_email_renderer
from polar.email.sender import get_email_sender
from polar.enums import TokenType
from polar.exceptions import PolarError
from polar.kit.crypto import get_token_hash
from polar.kit.services import ResourceServiceReader
from polar.logging import Logger
from polar.models import OAuth2Token, User
from polar.models.organization import Organization
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .oauth2_client import oauth2_client as oauth2_client_service

log: Logger = structlog.get_logger()


class OAuth2TokenError(PolarError): ...


class OAuth2TokenService(ResourceServiceReader[OAuth2Token]):
    async def get_by_access_token(
        self, session: AsyncSession, access_token: str
    ) -> OAuth2Token | None:
        access_token_hash = get_token_hash(access_token, secret=settings.SECRET)
        statement = select(OAuth2Token).where(
            OAuth2Token.access_token == access_token_hash
        )
        result = await session.execute(statement)
        token = result.unique().scalar_one_or_none()
        if token is not None and not cast(bool, token.is_revoked()):
            return token
        return None

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
            joinedload(OAuth2Token.user), joinedload(OAuth2Token.organization)
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

        # Revoke
        oauth2_token.access_token_revoked_at = int(time.time())  # pyright: ignore
        oauth2_token.refresh_token_revoked_at = int(time.time())  # pyright: ignore
        session.add(oauth2_token)

        # Notify
        email_renderer = get_email_renderer({"oauth2": "polar.oauth2"})
        email_sender = get_email_sender()

        recipients: list[str]
        sub = oauth2_token.sub
        if isinstance(sub, User):
            recipients = [sub.email]
        elif isinstance(sub, Organization):
            members = await user_organization_service.list_by_org(session, sub.id)
            recipients = [member.user.email for member in members]

        oauth2_client = await oauth2_client_service.get_by_client_id(
            session, cast(str, oauth2_token.client_id)
        )
        assert oauth2_client is not None

        subject, body = email_renderer.render_from_template(
            "Security Notice - Your Polar Access Token has been leaked",
            "oauth2/leaked_token.html",
            {
                "client_name": oauth2_client.client_name,
                "notifier": notifier,
                "url": url,
                "current_year": datetime.datetime.now().year,
            },
        )

        for recipient in recipients:
            email_sender.send_to_user(
                to_email_addr=recipient,
                subject=subject,
                html_content=body,
                from_email_addr="noreply@notifications.polar.sh",
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
