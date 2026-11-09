from collections.abc import AsyncIterator

import httpx
import pytest

from polar.auth.scope import READ_ONLY_SCOPES, Scope
from polar.auth.service import auth as auth_service
from polar.backoffice import app as backoffice_app
from polar.backoffice.auth.service import create_user_session
from polar.config import settings
from polar.models import BackofficeUser, Organization, User, UserOrganization
from polar.postgres import AsyncSession, get_db_session

BACKOFFICE_HOST = "backoffice.polar.test"
DASHBOARD_HOST = "polar.test"


@pytest.fixture
async def client(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[httpx.AsyncClient]:
    monkeypatch.setattr(settings, "BACKOFFICE_HOST", BACKOFFICE_HOST)
    monkeypatch.setattr(settings, "FRONTEND_BASE_URL", f"https://{DASHBOARD_HOST}")
    monkeypatch.setattr(settings, "USER_SESSION_COOKIE_DOMAIN", DASHBOARD_HOST)
    monkeypatch.setitem(
        backoffice_app.dependency_overrides, get_db_session, lambda: session
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=backoffice_app),
        base_url=f"https://{BACKOFFICE_HOST}",
    ) as client:
        yield client


@pytest.mark.anyio
class TestImpersonation:
    @pytest.mark.parametrize("has_dashboard_session", [True, False])
    async def test_swap_and_restore_dashboard_session(
        self,
        client: httpx.AsyncClient,
        session: AsyncSession,
        backoffice_user: BackofficeUser,
        organization: Organization,
        user: User,
        user_second: User,
        user_organization: UserOrganization,
        has_dashboard_session: bool,
    ) -> None:
        original_token = None
        if has_dashboard_session:
            original_token, _ = await auth_service._create_user_session(
                session, user_second, user_agent="tests", scopes=list(Scope)
            )
            client.cookies.set(
                settings.USER_SESSION_COOKIE_KEY,
                original_token,
                domain=f".{DASHBOARD_HOST}",
            )

        data = {"user_id": str(user.id), "organization_id": str(organization.id)}
        assert (await client.post("/impersonation/start", data=data)).status_code == 401

        staff_token = await create_user_session(session, backoffice_user)
        client.cookies.set(
            settings.BACKOFFICE_USER_SESSION_COOKIE_KEY,
            staff_token,
            domain=BACKOFFICE_HOST,
        )
        response = await client.post("/impersonation/start", data=data)
        assert response.status_code == 303
        assert response.headers["location"] == (
            f"https://{DASHBOARD_HOST}/dashboard/{organization.slug}"
        )
        assert client.cookies.get(settings.IMPERSONATION_COOKIE_KEY) == original_token
        dashboard_request = client.build_request("GET", f"https://{DASHBOARD_HOST}/")
        dashboard_cookies = dashboard_request.headers["cookie"]
        assert settings.IMPERSONATION_COOKIE_KEY not in dashboard_cookies
        assert settings.USER_SESSION_COOKIE_KEY in dashboard_cookies
        assert settings.IMPERSONATION_INDICATOR_COOKIE_KEY in dashboard_cookies
        if has_dashboard_session:
            restore_cookie = next(
                cookie
                for cookie in client.cookies.jar
                if cookie.name == settings.IMPERSONATION_COOKIE_KEY
            )
            assert restore_cookie.domain == BACKOFFICE_HOST
            assert not restore_cookie.domain_specified

        impersonation_token = client.cookies[settings.USER_SESSION_COOKIE_KEY]
        impersonation_session = await auth_service._get_user_session_by_token(
            session, impersonation_token
        )
        assert impersonation_session is not None
        assert impersonation_session.user_id == user.id
        assert set(impersonation_session.scopes) == READ_ONLY_SCOPES
        assert {
            scope.organization_id for scope in impersonation_session.organization_scopes
        } == {organization.id}

        response = await client.get("/impersonation/end")
        assert response.status_code == 307
        assert response.headers["location"] == f"https://{BACKOFFICE_HOST}/"
        assert client.cookies.get(settings.USER_SESSION_COOKIE_KEY) == original_token
        assert settings.IMPERSONATION_COOKIE_KEY not in client.cookies
        assert settings.IMPERSONATION_INDICATOR_COOKIE_KEY not in client.cookies
        assert (
            client.cookies[settings.BACKOFFICE_USER_SESSION_COOKIE_KEY] == staff_token
        )
        if original_token is not None:
            response = await client.get("/impersonation/end")
            assert response.status_code == 307
            assert client.cookies[settings.USER_SESSION_COOKIE_KEY] == original_token
            assert (
                await auth_service._get_user_session_by_token(session, original_token)
                is not None
            )
