from typing import Sequence
from uuid import UUID
import structlog
from polar.postgres import AsyncSession, sql
from polar.models import UserOrganization, UserOrganizationSettings
from polar.user_organization.schemas import UserOrganizationSettingsUpdate


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
    ) -> UserOrganizationSettings:
        stmt = sql.select(UserOrganizationSettings).where(
            UserOrganizationSettings.user_id == user_id,
            UserOrganizationSettings.organization_id == org_id,
        )
        # TODO: create if not exists
        res = await session.execute(stmt)
        return res.scalar_one()

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

        values: dict[str, bool] = {}

        for k, v in set.dict().items():
            if v is not None:
                values[k] = v

        stmt.values(values)

        await session.execute(stmt)


user_organization = UserOrganizationervice()
