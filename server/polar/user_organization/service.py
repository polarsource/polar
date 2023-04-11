from typing import Sequence
from uuid import UUID
import structlog
from polar.postgres import AsyncSession, sql
from polar.models import UserOrganization, UserOrganizationSettings
from polar.user_organization.schemas import (
    UserOrganizationSettingsRead,
    UserOrganizationSettingsUpdate,
)
from sqlalchemy.exc import NoResultFound


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
        stmt = sql.update(UserOrganizationSettings).where(
            UserOrganizationSettings.user_id == user_id,
            UserOrganizationSettings.organization_id == org_id,
        )

        # TODO: or insert

        values: dict[str, bool] = {}

        for k, v in set.dict().items():
            if v is not None:
                values[k] = v

        stmt.values(values)

        await session.execute(stmt)


user_organization = UserOrganizationervice()
