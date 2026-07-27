import pytest
from sqlalchemy import select

from polar.auth.scope import Scope
from polar.auth.service import auth as auth_service
from polar.models import Organization, User, UserSessionOrganization
from polar.postgres import AsyncSession


@pytest.mark.asyncio
class TestCreateUserSession:
    async def test_unscoped_by_default(self, session: AsyncSession, user: User) -> None:
        _, user_session = await auth_service._create_user_session(
            session, user, user_agent="", scopes=list(Scope)
        )

        result = await session.execute(
            select(UserSessionOrganization).where(
                UserSessionOrganization.user_session_id == user_session.id
            )
        )
        assert result.scalars().all() == []

    async def test_scoped_to_organizations(
        self, session: AsyncSession, user: User, organization: Organization
    ) -> None:
        _, user_session = await auth_service._create_user_session(
            session,
            user,
            user_agent="",
            scopes=list(Scope),
            organization_ids=frozenset({organization.id}),
        )

        assert [
            scope.organization_id for scope in user_session.organization_scopes
        ] == [organization.id]
