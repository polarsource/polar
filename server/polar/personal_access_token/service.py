from collections.abc import Sequence
from datetime import timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.extensions.sqlalchemy import sql
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.models import PersonalAccessToken
from polar.postgres import AsyncSession


class PersonalAccessTokenService(ResourceServiceReader[PersonalAccessToken]):
    async def get_by_token(
        self, session: AsyncSession, token: str, *, expired: bool = False
    ) -> PersonalAccessToken | None:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        statement = (
            select(PersonalAccessToken)
            .where(PersonalAccessToken.token == token_hash)
            .options(joinedload(PersonalAccessToken.user))
        )
        if not expired:
            statement = statement.where(PersonalAccessToken.expires_at > utc_now())

        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def list_for_user(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[PersonalAccessToken]:
        stmt = sql.select(PersonalAccessToken).where(
            PersonalAccessToken.user_id == user_id,
            PersonalAccessToken.deleted_at.is_(None),
        )

        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def create(
        self, session: AsyncSession, user_id: UUID, comment: str
    ) -> PersonalAccessToken:
        pat = PersonalAccessToken(
            user_id=user_id,
            comment=comment,
            expires_at=utc_now() + timedelta(days=365),
        )
        session.add(pat)
        await session.flush()
        return pat

    async def delete(self, session: AsyncSession, id: UUID) -> None:
        stmt = (
            sql.update(PersonalAccessToken)
            .where(PersonalAccessToken.id == id)
            .values(deleted_at=utc_now())
        )

        await session.execute(stmt)
        await session.commit()

    async def record_usage(self, session: AsyncSession, id: UUID) -> None:
        stmt = (
            sql.update(PersonalAccessToken)
            .where(PersonalAccessToken.id == id)
            .values(last_used_at=utc_now())
        )
        await session.execute(stmt)
        await session.commit()


personal_access_token = PersonalAccessTokenService(PersonalAccessToken)
