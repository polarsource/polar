import pytest
from starlette.requests import Request

from polar.auth.middlewares import get_auth_subject
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.models import Organization, User, UserOrganization
from polar.models.user_session_organization import UserSessionOrganization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture


def _request_with_session_cookie(token: str) -> Request:
    cookie = f"{settings.USER_SESSION_COOKIE_KEY}={token}".encode()
    return Request({"type": "http", "headers": [(b"cookie", cookie)]})


@pytest.mark.asyncio
class TestGetAuthSubjectUserSessionScope:
    async def test_unscoped_session_is_unrestricted(
        self,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        token, _ = await auth_service._create_user_session(
            session, user, user_agent="test", scopes=[]
        )

        auth_subject = await get_auth_subject(
            _request_with_session_cookie(token), session
        )

        assert auth_subject.subject == user
        assert auth_subject.organization_ids is None

    async def test_scoped_session_populates_organization_ids(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        user: User,
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        token, user_session = await auth_service._create_user_session(
            session, user, user_agent="test", scopes=[]
        )
        await save_fixture(
            UserSessionOrganization(
                user_session_id=user_session.id, organization_id=organization.id
            )
        )
        auth_subject = await get_auth_subject(
            _request_with_session_cookie(token), session
        )

        assert auth_subject.organization_ids == frozenset({organization.id})
