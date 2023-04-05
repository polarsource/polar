from typing import Sequence
from uuid import UUID
import structlog
from polar.postgres import AsyncSession, sql
from polar.models import UserOrganization


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


user_organization = UserOrganizationervice()
