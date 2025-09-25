from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import structlog
from sqlalchemy import Select, or_, select, update
from sqlalchemy.orm import contains_eager

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.email.react import render_email_template
from polar.email.sender import enqueue_email
from polar.enums import TokenType
from polar.kit.crypto import get_token_hash
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import PersonalAccessToken, User
from polar.postgres import AsyncSession

log: Logger = structlog.get_logger()

TOKEN_PREFIX = "polar_pat_"


class PersonalAccessTokenService(ResourceServiceReader[PersonalAccessToken]):
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[PersonalAccessToken], int]:
        statement = self._get_readable_order_statement(auth_subject)
        return await paginate(session, statement, pagination=pagination)

    async def get_by_id(
        self, session: AsyncSession, auth_subject: AuthSubject[User], id: UUID
    ) -> PersonalAccessToken | None:
        statement = self._get_readable_order_statement(auth_subject).where(
            PersonalAccessToken.id == id,
            PersonalAccessToken.deleted_at.is_(None),
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_token(
        self, session: AsyncSession, token: str, *, expired: bool = False
    ) -> PersonalAccessToken | None:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        statement = (
            select(PersonalAccessToken)
            .join(PersonalAccessToken.user)
            .where(
                PersonalAccessToken.token == token_hash,
                PersonalAccessToken.deleted_at.is_(None),
                User.can_authenticate.is_(True),
            )
            .options(contains_eager(PersonalAccessToken.user))
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

    async def delete(
        self, session: AsyncSession, personal_access_token: PersonalAccessToken
    ) -> None:
        personal_access_token.set_deleted_at()
        session.add(personal_access_token)

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
                "url": url or "",
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

    def _get_readable_order_statement(
        self, auth_subject: AuthSubject[User]
    ) -> Select[tuple[PersonalAccessToken]]:
        return select(PersonalAccessToken).where(
            PersonalAccessToken.user_id == auth_subject.subject.id,
            PersonalAccessToken.deleted_at.is_(None),
        )


personal_access_token = PersonalAccessTokenService(PersonalAccessToken)
