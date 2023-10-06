from typing import Any, Sequence
from uuid import UUID

import structlog
from sqlalchemy import and_
from sqlalchemy.exc import NoResultFound

from polar.models import UserOrganization, UserOrganizationSettings
from polar.postgres import AsyncSession, sql
from polar.user_organization.schemas import (
    UserOrganizationSettingsRead,
    UserOrganizationSettingsUpdate,
)

log = structlog.get_logger()


class UserOrganizationervice:
    async def list_by_org(
        self, session: AsyncSession, org_id: UUID
    ) -> Sequence[UserOrganization]:
        stmt = sql.select(UserOrganization).where(
            UserOrganization.organization_id == org_id
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
        )
        res = await session.execute(stmt)
        return res.scalars().unique().all()

    async def get_by_user_and_org(
        self,
        session: AsyncSession,
        user_id: UUID,
        organization_id: UUID,
    ) -> UserOrganization | None:
        stmt = sql.select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id == organization_id,
            UserOrganization.deleted_at.is_(None),
        )
        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

    async def get_settings(
        self,
        session: AsyncSession,
        user_id: UUID,
        org_id: UUID,
    ) -> UserOrganizationSettingsRead:
        stmt = sql.select(UserOrganizationSettings).where(
            UserOrganizationSettings.user_id == user_id,
            UserOrganizationSettings.organization_id == org_id,
        )

        try:
            res = await session.execute(stmt)
            return UserOrganizationSettingsRead.from_orm(res.scalar_one())
        except NoResultFound:
            # If no custom settings found, use defaults
            return UserOrganizationSettingsRead()

    async def update_settings(
        self,
        session: AsyncSession,
        user_id: UUID,
        org_id: UUID,
        set: UserOrganizationSettingsUpdate,
    ) -> None:
        values: dict[str, Any] = {"user_id": user_id, "organization_id": org_id}
        for k, v in set.dict().items():
            if v is not None:
                values[k] = v

        stmt = (
            sql.insert(UserOrganizationSettings)
            .values(
                values,
            )
            .on_conflict_do_update(
                set_=values,
                index_elements=[
                    UserOrganizationSettings.user_id,
                    UserOrganizationSettings.organization_id,
                ],
                where=and_(
                    UserOrganizationSettings.user_id == user_id,
                    UserOrganizationSettings.organization_id == org_id,
                ),
            )
        )

        await session.execute(stmt)
        await session.commit()


user_organization = UserOrganizationervice()
