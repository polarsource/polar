from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func
from sqlalchemy.orm import joinedload

from polar.kit.utils import utc_now
from polar.models import UserOrganization
from polar.postgres import AsyncSession, sql


class UserOrganizationService:
    async def list_by_org(
        self, session: AsyncSession, org_id: UUID
    ) -> Sequence[UserOrganization]:
        stmt = (
            sql.select(UserOrganization)
            .where(
                UserOrganization.organization_id == org_id,
                UserOrganization.deleted_at.is_(None),
            )
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
        stmt = self._get_list_by_user_id_query(user_id)
        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def get_user_organization_count(
        self, session: AsyncSession, user_id: UUID
    ) -> int:
        stmt = self._get_list_by_user_id_query(
            user_id, ordered=False
        ).with_only_columns(func.count(UserOrganization.organization_id))
        res = await session.execute(stmt)
        count = res.scalar()
        if count:
            return count
        return 0

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

    async def remove_member(
        self,
        session: AsyncSession,
        user_id: UUID,
        organization_id: UUID,
    ) -> None:
        stmt = (
            sql.update(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.organization_id == organization_id,
                UserOrganization.deleted_at.is_(None),
            )
            .values(deleted_at=utc_now())
        )
        await session.execute(stmt)
        await session.commit()

    def _get_list_by_user_id_query(
        self, user_id: UUID, ordered: bool = True
    ) -> Select[tuple[UserOrganization]]:
        stmt = (
            sql.select(UserOrganization)
            .where(
                UserOrganization.user_id == user_id,
                UserOrganization.deleted_at.is_(None),
            )
            .options(
                joinedload(UserOrganization.user),
                joinedload(UserOrganization.organization),
            )
        )
        if ordered:
            stmt = stmt.order_by(UserOrganization.created_at.asc())

        return stmt


user_organization = UserOrganizationService()
