from urllib.parse import urlsplit

import httpx
import pytest

from polar.auth.scope import READ_ONLY_SCOPES, Scope
from polar.auth.service import auth as auth_service
from polar.backoffice.access import RETURN_COOKIE, SESSION_COOKIE
from polar.config import settings
from polar.models import OAuth2Token, Organization, User, UserOrganization
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import SaveFixture


@pytest.mark.asyncio
class TestImpersonationBridge:
    @pytest.mark.parametrize("public_client", ["public", "disabled"], indirect=True)
    async def test_round_trip(
        self,
        private_client: httpx.AsyncClient,
        public_client: httpx.AsyncClient,
        admin_token: OAuth2Token,
        user: User,
        user_second: User,
        organization: Organization,
        organization_second: Organization,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        await save_fixture(
            UserOrganization(user=user_second, organization=organization)
        )
        admin_cookie, _ = await auth_service._create_user_session(
            session, user, user_agent="test", scopes=list(Scope)
        )
        public_client.cookies.set(
            settings.USER_SESSION_COOKIE_KEY, admin_cookie, domain=".polar.sh"
        )
        private_client.cookies.set(SESSION_COOKIE, "backoffice-token")
        session.expunge_all()
        response = await private_client.post(
            "/impersonation/start",
            data={
                "user_id": str(user_second.id),
                "organization_id": str(organization.id),
            },
            headers={"HX-Request": "true"},
        )
        assert response.status_code == 200
        bridge_url = response.headers["hx-redirect"]
        assert urlsplit(bridge_url).hostname == "api.polar.sh"
        assert "set-cookie" not in response.headers
        session.expunge_all()
        response = await public_client.get(bridge_url)
        assert response.status_code == 307
        assert (
            response.headers["location"]
            == f"https://polar.sh/dashboard/{organization.slug}"
        )
        assert response.headers["cache-control"] == "no-store"
        assert public_client.cookies[settings.IMPERSONATION_COOKIE_KEY] == admin_cookie
        assert public_client.cookies[RETURN_COOKIE] == "1"
        impersonated_cookie = public_client.cookies[settings.USER_SESSION_COOKIE_KEY]
        assert impersonated_cookie != admin_cookie
        impersonated = await auth_service._get_user_session_by_token(
            session, impersonated_cookie
        )
        assert impersonated is not None
        assert impersonated.user_id == user_second.id
        assert set(impersonated.scopes) == READ_ONLY_SCOPES
        assert {
            scope.organization_id for scope in impersonated.organization_scopes
        } == {organization.id}
        session.expunge_all()
        assert (await private_client.get("/")).status_code == 200
        assert (await public_client.get(bridge_url)).status_code == 400
        await save_fixture(
            UserOrganization(user=user_second, organization=organization_second)
        )
        response = await private_client.post(
            "/impersonation/start",
            data={
                "user_id": str(user_second.id),
                "organization_id": str(organization_second.id),
            },
        )
        session.expunge_all()
        response = await public_client.get(response.headers["location"])
        assert response.status_code == 307
        assert (
            response.headers["location"]
            == f"https://polar.sh/dashboard/{organization_second.slug}"
        )
        assert public_client.cookies[settings.IMPERSONATION_COOKIE_KEY] == admin_cookie
        assert (
            await auth_service._get_user_session_by_token(session, impersonated_cookie)
            is None
        )
        impersonated_cookie = public_client.cookies[settings.USER_SESSION_COOKIE_KEY]
        impersonated = await auth_service._get_user_session_by_token(
            session, impersonated_cookie
        )
        assert impersonated is not None
        assert impersonated.user_id == user_second.id
        assert set(impersonated.scopes) == READ_ONLY_SCOPES
        assert {
            scope.organization_id for scope in impersonated.organization_scopes
        } == {organization_second.id}
        session.expunge_all()
        response = await public_client.get("/v1/backoffice/impersonation/end")
        assert response.status_code == 307
        assert response.headers["location"] == (
            f"{settings.BACKOFFICE_PRIVATE_URL}/organizations/{organization_second.id}"
        )
        assert public_client.cookies[settings.USER_SESSION_COOKIE_KEY] == admin_cookie
        assert settings.IMPERSONATION_COOKIE_KEY not in public_client.cookies
        assert settings.IMPERSONATION_INDICATOR_COOKIE_KEY not in public_client.cookies
        assert RETURN_COOKIE not in public_client.cookies
        assert (
            await auth_service._get_user_session_by_token(session, impersonated_cookie)
            is None
        )
        assert (await private_client.get("/")).status_code == 200

    @pytest.mark.parametrize("failure", ["different_admin", "revoked", "expired_grant"])
    async def test_rejects_invalid_handoff(
        self,
        private_client: httpx.AsyncClient,
        public_client: httpx.AsyncClient,
        admin_token: OAuth2Token,
        user: User,
        user_second: User,
        session: AsyncSession,
        save_fixture: SaveFixture,
        redis: Redis,
        failure: str,
    ) -> None:
        private_client.cookies.set(SESSION_COOKIE, "backoffice-token")
        response = await private_client.post(
            "/impersonation/start", data={"user_id": str(user_second.id)}
        )
        bridge_url = response.headers["location"]
        if failure == "different_admin":
            user_second.is_admin = True
            await save_fixture(user_second)
        if failure == "revoked":
            admin_token.access_token_revoked_at = 1
            await save_fixture(admin_token)
        if failure == "expired_grant":
            for key in await redis.keys("backoffice:impersonation:*"):
                await redis.delete(key)
        cookie, _ = await auth_service._create_user_session(
            session,
            user_second if failure == "different_admin" else user,
            user_agent="test",
            scopes=list(Scope),
        )
        public_client.cookies.set(
            settings.USER_SESSION_COOKIE_KEY, cookie, domain=".polar.sh"
        )
        session.expunge_all()
        response = await public_client.get(bridge_url)
        assert response.status_code == (400 if failure == "expired_grant" else 403)
        assert "set-cookie" not in response.headers
        assert public_client.cookies[settings.USER_SESSION_COOKIE_KEY] == cookie

    @pytest.mark.parametrize("current_cookie", ["missing", "original"])
    async def test_restore_preserves_original_session(
        self,
        public_client: httpx.AsyncClient,
        admin_token: OAuth2Token,
        user: User,
        session: AsyncSession,
        current_cookie: str,
    ) -> None:
        admin_cookie, _ = await auth_service._create_user_session(
            session, user, user_agent="test", scopes=list(Scope)
        )
        public_client.cookies.set(
            settings.IMPERSONATION_COOKIE_KEY, admin_cookie, domain=".polar.sh"
        )
        public_client.cookies.set(RETURN_COOKIE, "1", domain=".polar.sh")
        if current_cookie == "original":
            public_client.cookies.set(
                settings.USER_SESSION_COOKIE_KEY, admin_cookie, domain=".polar.sh"
            )
        session.expunge_all()
        response = await public_client.get("/v1/backoffice/impersonation/end")
        assert response.status_code == 307
        assert response.headers["location"] == f"{settings.BACKOFFICE_PRIVATE_URL}/"
        assert public_client.cookies[settings.USER_SESSION_COOKIE_KEY] == admin_cookie
        assert settings.IMPERSONATION_COOKIE_KEY not in public_client.cookies
        assert (
            await auth_service._get_user_session_by_token(session, admin_cookie)
            is not None
        )
