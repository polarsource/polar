from collections.abc import Sequence
from datetime import timedelta
from uuid import UUID

from sqlalchemy.orm import joinedload

from polar.kit.extensions.sqlalchemy import sql
from polar.kit.utils import utc_now
from polar.models.personal_access_token import PersonalAccessToken
from polar.postgres import AsyncSession


class PersonalAccessTokenService:
    async def get(
        self, session: AsyncSession, id: UUID, load_user: bool = False
    ) -> PersonalAccessToken | None:
        stmt = sql.select(PersonalAccessToken).where(
            PersonalAccessToken.id == id,
            PersonalAccessToken.deleted_at.is_(None),
            PersonalAccessToken.expires_at > utc_now(),
        )

        if load_user:
            stmt = stmt.options(joinedload(PersonalAccessToken.user))

        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

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
        pat = await PersonalAccessToken.create(
            session=session,
            user_id=user_id,
            comment=comment,
            expires_at=utc_now() + timedelta(days=365),
        )
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


personal_access_token_service = PersonalAccessTokenService()
