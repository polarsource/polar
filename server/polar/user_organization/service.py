from typing import Sequence
from uuid import UUID

import structlog
from sqlalchemy.orm import joinedload

from polar.models import UserOrganization
from polar.postgres import AsyncSession, sql


log = structlog.get_logger()


class UserOrganizationervice:
    async def list_by_org(
        self, session: AsyncSession, org_id: UUID
    ) -> Sequence[UserOrganization]:
        stmt = (
            sql.select(UserOrganization)
            .where(UserOrganization.organization_id == org_id)
            .options(
                joinedload(UserOrganization.user),
                joinedload(UserOrganization.organization),
            )
        )

        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def list_by_user_id(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[UserOrganization]:
        stmt = (
            sql.select(UserOrganization)
            .where(UserOrganization.user_id == user_id)
            .order_by(UserOrganization.created_at.asc())
            .options(
                joinedload(UserOrganization.user),
                joinedload(UserOrganization.organization),
            )
        )
        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def get_by_user_and_org(
        self,
        session: AsyncSession,
        user_id: UUID,
        organization_id: UUID,
    ) -> UserOrganization | None:
        stmt = (
            sql.select(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.organization_id == organization_id,
                UserOrganization.deleted_at.is_(None),
            )
            .options(
                joinedload(UserOrganization.user),
                joinedload(UserOrganization.organization),
            )
        )

        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()


user_organization = UserOrganizationervice()
