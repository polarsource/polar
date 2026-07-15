from unittest.mock import MagicMock

import pytest
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from starlette.requests import Request

from polar.backoffice.impersonation.endpoints import start_impersonation
from polar.models import Organization, User, UserOrganization, UserSession
from polar.postgres import AsyncSession


def _request() -> Request:
    return Request(
        {
            "type": "http",
            "method": "POST",
            "path": "/start",
            "headers": [(b"user-agent", b"test"), (b"host", b"127.0.0.1")],
            "query_string": b"",
            "scheme": "http",
            "server": ("127.0.0.1", 8000),
        }
    )


@pytest.mark.asyncio
class TestStartImpersonation:
    async def test_scopes_session_to_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        # The impersonation session must be scoped to the organization so it can
        # reach the org even when SSO is enforced (and eventually break the glass
        # if something is missconfigured).
        await start_impersonation(
            request=_request(),
            admin_session=MagicMock(),
            user_id=str(user.id),
            organization_id=str(organization.id),
            session=session,
        )

        result = await session.execute(
            select(UserSession)
            .where(UserSession.user_id == user.id)
            .options(selectinload(UserSession.organization_scopes))
        )
        user_session = result.unique().scalars().one()
        assert {
            scope.organization_id for scope in user_session.organization_scopes
        } == {organization.id}
