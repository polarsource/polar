import httpx
import pytest

from polar.auth.scope import READ_ONLY_SCOPES, Scope
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.models import OAuth2Token, Organization, User, UserOrganization
from polar.postgres import AsyncSession


@pytest.mark.asyncio
class TestImpersonation:
    @pytest.mark.parametrize("public_client", ["public"], indirect=True)
    async def test_round_trip(
        self,
        public_client: httpx.AsyncClient,
        admin_token: OAuth2Token,
        session: AsyncSession,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        admin_cookie, _ = await auth_service._create_user_session(
            session, user, user_agent="test", scopes=list(Scope)
        )
        public_client.cookies.set(
            settings.USER_SESSION_COOKIE_KEY, admin_cookie, domain=".polar.sh"
        )
        session.expunge_all()
        response = await public_client.post(
            "/backoffice/impersonation/start",
            data={"user_id": str(user.id), "organization_id": str(organization.id)},
        )
        assert response.status_code == 307
        assert (
            response.headers["location"]
            == f"https://polar.sh/dashboard/{organization.slug}"
        )
        cookie = public_client.cookies[settings.USER_SESSION_COOKIE_KEY]
        impersonated = await auth_service._get_user_session_by_token(session, cookie)
        assert impersonated is not None
        assert set(impersonated.scopes) == READ_ONLY_SCOPES
        assert {
            scope.organization_id for scope in impersonated.organization_scopes
        } == {organization.id}
        assert public_client.cookies[settings.IMPERSONATION_COOKIE_KEY] == admin_cookie
        session.expunge_all()
        response = await public_client.get("/backoffice/impersonation/end")
        assert response.status_code == 307
        assert response.headers["location"] == settings.generate_backoffice_url(
            f"/organizations/{organization.id}"
        )
        assert public_client.cookies[settings.USER_SESSION_COOKIE_KEY] == admin_cookie
        assert settings.IMPERSONATION_COOKIE_KEY not in public_client.cookies
        assert settings.IMPERSONATION_INDICATOR_COOKIE_KEY not in public_client.cookies
        assert await auth_service._get_user_session_by_token(session, cookie) is None
        assert (
            await auth_service._get_user_session_by_token(session, admin_cookie)
            is not None
        )
