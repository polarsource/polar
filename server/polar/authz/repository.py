from uuid import UUID

from sqlalchemy import select

from polar.models import UserOrganization
from polar.postgres import AsyncReadSession


class AuthzRepository:
    def __init__(self, session: AsyncReadSession) -> None:
        self.session = session

    async def get_user_org_ids(self, user_id: UUID) -> set[UUID]:
        """Get all organization IDs a user is a member of."""
        stmt = select(UserOrganization.organization_id).where(
            UserOrganization.user_id == user_id,
            UserOrganization.is_deleted.is_(False),
        )
        result = await self.session.scalars(stmt)
        return set(result.all())
