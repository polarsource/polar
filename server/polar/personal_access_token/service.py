from datetime import datetime
from uuid import UUID

import structlog
from sqlalchemy import or_, select, update
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.email.react import render_email_template
from polar.email.sender import enqueue_email
from polar.enums import TokenType
from polar.kit.crypto import get_token_hash
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import PersonalAccessToken
from polar.postgres import AsyncSession

log: Logger = structlog.get_logger()

TOKEN_PREFIX = "polar_pat_"


class PersonalAccessTokenService(ResourceServiceReader[PersonalAccessToken]):
    async def get_by_token(
        self, session: AsyncSession, token: str, *, expired: bool = False
    ) -> PersonalAccessToken | None:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        statement = (
            select(PersonalAccessToken)
            .where(
                PersonalAccessToken.token == token_hash,
                PersonalAccessToken.deleted_at.is_(None),
            )
            .options(joinedload(PersonalAccessToken.user))
        )
        if not expired:
            statement = statement.where(
                or_(
                    PersonalAccessToken.expires_at.is_(None),
                    PersonalAccessToken.expires_at > utc_now(),
                )
            )

        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def record_usage(
        self, session: AsyncSession, id: UUID, last_used_at: datetime
    ) -> None:
        statement = (
            update(PersonalAccessToken)
            .where(PersonalAccessToken.id == id)
            .values(last_used_at=last_used_at)
        )
        await session.execute(statement)

    async def revoke_leaked(
        self,
        session: AsyncSession,
        token: str,
        token_type: TokenType,
        *,
        notifier: str,
        url: str | None = None,
    ) -> bool:
        personal_access_token = await self.get_by_token(session, token)

        if personal_access_token is None:
            return False

        personal_access_token.set_deleted_at()
        session.add(personal_access_token)

        body = render_email_template(
            "personal_access_token_leaked",
            {
                "personal_access_token": personal_access_token.comment,
                "notifier": notifier,
                "url": url,
                "current_year": datetime.now().year,
            },
        )

        enqueue_email(
            to_email_addr=personal_access_token.user.email,
            subject="Security Notice - Your Polar Personal Access Token has been leaked",
            html_content=body,
        )

        log.info(
            "Revoke leaked personal access token",
            id=personal_access_token.id,
            notifier=notifier,
            url=url,
        )

        return True


personal_access_token = PersonalAccessTokenService(PersonalAccessToken)
