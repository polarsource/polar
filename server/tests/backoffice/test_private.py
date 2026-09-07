import time
from email.utils import parsedate_to_datetime
from http.cookies import SimpleCookie
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
from authlib.oauth2.rfc7636 import create_s256_code_challenge
from fastapi import FastAPI
from pytest_mock import MockerFixture
from respx import MockRouter

from polar.app import create_app
from polar.auth.oauth2.state import OAuth2StateService
from polar.backoffice.access import SESSION_COOKIE
from polar.config import settings
from polar.models import OAuth2State, OAuth2Token, User
from polar.oauth2.service.oauth2_token import oauth2_token as oauth2_token_service
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from tests.fixtures.database import SaveFixture

PRIVATE_URL = "https://backoffice.example.ts.net"


@pytest.mark.asyncio
class TestPrivateAccess:
    async def test_requires_login(self, private_client: httpx.AsyncClient) -> None:
        response = await private_client.get("/")
        assert response.status_code == 303
        assert response.headers["location"] == "/auth/login?return_to=%2F"

    @pytest.mark.parametrize("htmx", [False, True])
    @pytest.mark.parametrize("method", ["GET", "POST"])
    async def test_expired_session_recovers_login(
        self,
        private_client: httpx.AsyncClient,
        admin_token: OAuth2Token,
        save_fixture: SaveFixture,
        htmx: bool,
        method: str,
    ) -> None:
        admin_token.issued_at = 1
        await save_fixture(admin_token)
        private_client.cookies.set(SESSION_COOKIE, "backoffice-token")
        path = (
            "/organizations/?query=example"
            if method == "GET"
            else "/impersonation/start"
        )
        response = await private_client.request(
            method, path, headers={"HX-Request": str(htmx).lower()}
        )
        assert response.status_code == (200 if htmx else 303)
        location = response.headers["hx-redirect" if htmx else "location"]
        assert urlsplit(location).path == "/auth/login"
        assert parse_qs(urlsplit(location).query)["return_to"] == [
            path if method == "GET" else "/"
        ]
        assert "set-cookie" not in response.headers

    async def test_admin_and_static(
        self, private_client: httpx.AsyncClient, admin_token: OAuth2Token
    ) -> None:
        private_client.cookies.set(SESSION_COOKIE, "backoffice-token")
        response = await private_client.get("/")
        assert response.status_code == 200
        assert "Dashboard" in response.text
        assert response.headers["cache-control"] == "no-store"
        response = await private_client.get("/static/not-a-file")
        assert response.status_code == 404
        private_client.cookies.clear()
        response = await private_client.get("/static/not-a-file")
        assert response.status_code == 303

    @pytest.mark.parametrize("path", ["/v1/users/me", "/healthz", "/docs"])
    async def test_no_public_api(
        self, private_client: httpx.AsyncClient, path: str
    ) -> None:
        response = await private_client.get(path)
        assert response.status_code == 404

    @pytest.mark.parametrize(
        "headers",
        [
            {"Tailscale-User-Login": ""},
            {"Tailscale-User-Login": "other@example.com"},
            {"Host": "backoffice.polar.sh"},
        ],
    )
    async def test_rejects_wrong_identity_or_host(
        self,
        private_client: httpx.AsyncClient,
        admin_token: OAuth2Token,
        headers: dict[str, str],
    ) -> None:
        private_client.cookies.set(SESSION_COOKIE, "backoffice-token")
        response = await private_client.get("/", headers=headers)
        assert response.status_code == 403

    async def test_rejects_untrusted_peer(self, private_app: FastAPI) -> None:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(
                app=private_app, client=("100.64.0.2", 12345)
            ),
            base_url=PRIVATE_URL,
        ) as client:
            response = await client.get(
                "/auth/login", headers={"Tailscale-User-Login": "admin@example.com"}
            )
        assert response.status_code == 403

    async def test_rejects_duplicate_identity(
        self, private_client: httpx.AsyncClient
    ) -> None:
        response = await private_client.get(
            "/auth/login",
            headers=[
                ("Tailscale-User-Login", "admin@example.com"),
                ("Tailscale-User-Login", "other@example.com"),
            ],
        )
        assert response.status_code == 403

    async def test_deleted_client(
        self,
        private_client: httpx.AsyncClient,
        admin_token: OAuth2Token,
        session: AsyncSession,
        save_fixture: SaveFixture,
    ) -> None:
        token = await oauth2_token_service.get_by_access_token(
            session, "backoffice-token"
        )
        assert token is not None
        token.client.set_deleted_at()
        await save_fixture(token.client)
        private_client.cookies.set(SESSION_COOKIE, "backoffice-token")
        assert (await private_client.get("/")).status_code == 403

    async def test_rejects_cross_origin_write(
        self, private_client: httpx.AsyncClient, admin_token: OAuth2Token
    ) -> None:
        private_client.cookies.set(SESSION_COOKIE, "backoffice-token")
        response = await private_client.post(
            "/auth/logout", headers={"Origin": "https://evil.example"}
        )
        assert response.status_code == 403
        response = await private_client.get("/")
        assert response.status_code == 200

    @pytest.mark.parametrize(
        ("field", "value", "expected"),
        [
            ("client_id", "other-client", 403),
            ("scope", "openid", 403),
            ("access_token_revoked_at", 1, 303),
            ("issued_at", 1, 303),
        ],
    )
    async def test_rejects_invalid_token(
        self,
        private_client: httpx.AsyncClient,
        admin_token: OAuth2Token,
        save_fixture: SaveFixture,
        field: str,
        value: str | int,
        expected: int,
    ) -> None:
        setattr(admin_token, field, value)
        await save_fixture(admin_token)
        private_client.cookies.set(SESSION_COOKIE, "backoffice-token")
        response = await private_client.get("/")
        assert response.status_code == expected

    async def test_admin_revocation_takes_effect(
        self,
        private_client: httpx.AsyncClient,
        admin_token: OAuth2Token,
        user: User,
        save_fixture: SaveFixture,
    ) -> None:
        user.is_admin = False
        await save_fixture(user)
        private_client.cookies.set(SESSION_COOKIE, "backoffice-token")
        response = await private_client.get("/")
        assert response.status_code == 403


@pytest.mark.asyncio
class TestPrivateOAuth:
    async def test_authorization_code_pkce(
        self,
        private_client: httpx.AsyncClient,
        admin_token: OAuth2Token,
        respx_mock: MockRouter,
        session: AsyncSession,
    ) -> None:
        response = await private_client.get(
            "/auth/login", params={"return_to": "/organizations/?query=example"}
        )
        assert response.status_code == 303
        authorize = urlsplit(response.headers["location"])
        assert response.headers["location"].startswith(
            settings.generate_frontend_url("/oauth2/authorize")
        )
        params = parse_qs(authorize.query)
        state_token = private_client.cookies[settings.OAUTH2_SESSION_STATE_COOKIE_KEY]
        state = await OAuth2StateService(session).get_by_token(state_token)
        assert state is not None
        assert state.code_verifier is not None
        assert params["state"] == [state_token]
        state_cookie = SimpleCookie(response.headers["set-cookie"])[
            settings.OAUTH2_SESSION_STATE_COOKIE_KEY
        ]
        expires_at = parsedate_to_datetime(state_cookie["expires"]).timestamp()
        assert (
            0
            < expires_at - time.time()
            <= settings.OAUTH2_SESSION_STATE_TTL.total_seconds()
        )
        assert expires_at == state.expires_at
        assert state_cookie["secure"]
        assert state_cookie["httponly"]
        assert not state_cookie["domain"]
        assert params["response_type"] == ["code"]
        assert params["client_id"] == ["backoffice-client"]
        assert params["scope"] == ["openid email"]
        assert params["code_challenge_method"] == ["S256"]
        assert params["code_challenge"] == [
            create_s256_code_challenge(state.code_verifier)
        ]
        token_request = respx_mock.post(
            settings.generate_external_url("/v1/oauth2/token")
        ).respond(
            200, json={"access_token": "backoffice-token", "token_type": "Bearer"}
        )
        session.expunge_all()
        response = await private_client.get(
            "/auth/callback", params={"code": "auth-code", "state": params["state"][0]}
        )
        assert response.status_code == 303
        assert response.headers["location"] == "/organizations/?query=example"
        body = parse_qs(token_request.calls.last.request.content.decode())
        assert body["code_verifier"] == [state.code_verifier]
        assert body["redirect_uri"] == [f"{PRIVATE_URL}/auth/callback"]
        assert body["client_id"] == ["backoffice-client"]
        cookie = response.headers.get_list("set-cookie")[0]
        assert "Domain=" not in cookie
        assert "HttpOnly" in cookie
        assert "Secure" in cookie
        assert "SameSite=lax" in cookie
        assert settings.OAUTH2_SESSION_STATE_COOKIE_KEY not in private_client.cookies
        assert await OAuth2StateService(session).get_by_token(state_token) is None
        private_client.cookies.set(
            settings.OAUTH2_SESSION_STATE_COOKIE_KEY, state_token
        )
        replay = await private_client.get(
            "/auth/callback", params={"code": "auth-code", "state": state_token}
        )
        assert replay.status_code == 403
        assert token_request.call_count == 1
        assert (await private_client.get("/")).status_code == 200
        assert (await private_client.post("/auth/logout")).status_code == 303
        await session.flush()
        assert (await private_client.get("/")).status_code == 303

    @pytest.mark.parametrize(
        "failure", ["wrong", "missing", "expired", "provider", "redirect_uri"]
    )
    async def test_invalid_state(
        self,
        private_client: httpx.AsyncClient,
        respx_mock: MockRouter,
        session: AsyncSession,
        save_fixture: SaveFixture,
        failure: str,
    ) -> None:
        await private_client.get("/auth/login")
        state_token = private_client.cookies[settings.OAUTH2_SESSION_STATE_COOKIE_KEY]
        state = await OAuth2StateService(session).get_by_token(state_token)
        assert state is not None
        if failure == "missing":
            private_client.cookies.clear()
        elif failure in {"expired", "provider", "redirect_uri"}:
            state_orm = await session.get(OAuth2State, state.id)
            assert state_orm is not None
            if failure == "expired":
                state_orm.expires_at = int(time.time()) - 1
            elif failure == "provider":
                state_orm.provider = "github"
            else:
                state_orm.redirect_uri = "https://other.example/callback"
            await save_fixture(state_orm)
        response = await private_client.get(
            "/auth/callback",
            params={
                "state": "wrong" if failure == "wrong" else state_token,
                "code": "auth-code",
            },
        )
        assert response.status_code == 403
        assert len(respx_mock.calls) == 0

    @pytest.mark.parametrize(
        "return_to",
        [
            "//evil.example",
            "/\\evil.example",
            "https://evil.example",
            "@evil.example",
            "///evil.example",
        ],
    )
    async def test_rejects_external_return_path(
        self,
        private_client: httpx.AsyncClient,
        session: AsyncSession,
        return_to: str,
    ) -> None:
        response = await private_client.get(
            "/auth/login", params={"return_to": return_to}
        )
        assert response.status_code == 303
        state = await OAuth2StateService(session).get_by_token(
            private_client.cookies[settings.OAUTH2_SESSION_STATE_COOKIE_KEY]
        )
        assert state is not None
        assert state.context == {"return_to": "/"}


@pytest.mark.asyncio
class TestPublicCutover:
    @pytest.mark.parametrize("host", ["api.polar.sh", "backoffice.polar.sh"])
    async def test_backoffice_is_unmounted(
        self, mocker: MockerFixture, session: AsyncSession, redis: Redis, host: str
    ) -> None:
        mocker.patch.object(settings, "BACKOFFICE_MODE", "disabled")
        mocker.patch.object(settings, "BACKOFFICE_HOST", "backoffice.polar.sh")
        app = create_app()
        app.dependency_overrides[get_db_session] = lambda: session
        app.dependency_overrides[get_redis] = lambda: redis
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app), base_url=f"https://{host}"
        ) as client:
            for path in ("/backoffice/", "/organizations/", "/impersonation/start"):
                assert (await client.get(path)).status_code == 404
            assert (await client.get("/healthz")).status_code == 200
