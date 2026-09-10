from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest
import pytest_asyncio
import respx
from fastapi import FastAPI
from reauth.crypto import get_token_hash
from sqlalchemy import select, update

from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import AuthenticationSession
from polar.models.user import OAuthAccount
from polar.postgres import AsyncSession
from tests.fixtures.base import IsolatedSessionTestClient
from tests.fixtures.database import SaveFixture

GITHUB_ACCOUNT_ID = "xxyyzz"
GITHUB_ACCESS_TOKEN = "gho_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
GITHUB_EMAIL = "foo@bar.com"
TOKEN_ENDPOINT = "https://github.com/login/oauth/access_token"
PROFILE_ENDPOINT = "https://api.github.com/user"
EMAILS_ENDPOINT = "https://api.github.com/user/emails"


@pytest_asyncio.fixture
async def oauth_client(
    app: FastAPI, session: AsyncSession
) -> AsyncIterator[httpx.AsyncClient]:
    # A 127.0.0.1 base URL keeps the auth-session and OAuth2-state cookies
    # non-Secure so httpx carries them across the redirect hops over plain http.
    async with IsolatedSessionTestClient(
        session=session,
        auto_expunge=False,
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1",
    ) as client:
        yield client


def _state_from_redirect(response: httpx.Response) -> str:
    query = urlsplit(response.headers["location"]).query
    return parse_qs(query)["state"][0]


def _query_params(response: httpx.Response) -> dict[str, list[str]]:
    return parse_qs(urlsplit(response.headers["location"]).query)


def _mock_github(mock: respx.MockRouter) -> None:
    mock.post(TOKEN_ENDPOINT).mock(
        return_value=httpx.Response(
            200,
            json={
                "access_token": GITHUB_ACCESS_TOKEN,
                "token_type": "bearer",
                "scope": "user user:email",
                "expires_in": 28800,
            },
        )
    )
    mock.get(PROFILE_ENDPOINT).mock(
        return_value=httpx.Response(
            200,
            json={"id": GITHUB_ACCOUNT_ID, "login": "testuser", "name": "Test User"},
        )
    )
    mock.get(EMAILS_ENDPOINT).mock(
        return_value=httpx.Response(
            200,
            json=[
                {
                    "email": GITHUB_EMAIL,
                    "primary": True,
                    "verified": True,
                    "visibility": "public",
                }
            ],
        )
    )


async def _start_and_authorize(
    client: httpx.AsyncClient,
) -> tuple[str, str]:
    """Run start → authorize, returning (state_token, auth_session_token)."""
    start = await client.post("/v1/auth/start", json={})
    assert start.status_code == 201
    auth_token = client.cookies.get(settings.AUTHENTICATION_SESSION_COOKIE_KEY)
    assert auth_token is not None

    authorize = await client.get("/v1/auth/github/authorize")
    assert authorize.status_code == 303
    state = _state_from_redirect(authorize)
    assert client.cookies.get(settings.OAUTH2_SESSION_STATE_COOKIE_KEY) == state

    return state, auth_token


async def _refresh_auth_session(
    session: AsyncSession, auth_token: str
) -> AuthenticationSession:
    token_hash = get_token_hash(auth_token, secret=settings.SECRET)
    result = await session.execute(
        select(AuthenticationSession)
        .where(AuthenticationSession.token_hash == token_hash)
        .execution_options(populate_existing=True)
    )
    return result.scalar_one()


async def _expire_auth_session(session: AsyncSession, auth_token: str) -> None:
    token_hash = get_token_hash(auth_token, secret=settings.SECRET)
    await session.execute(
        update(AuthenticationSession)
        .where(AuthenticationSession.token_hash == token_hash)
        .values(expires_at=int(utc_now().timestamp()) - 3600)
    )
    await session.flush()


@pytest.mark.asyncio
class TestGithubLoginCallback:
    async def test_missing_state_redirects_with_error(
        self, oauth_client: httpx.AsyncClient
    ) -> None:
        response = await oauth_client.get("/v1/auth/github/callback")

        assert response.status_code == 303
        assert _query_params(response)["error"] == ["Missing OAuth2 state"]

    async def test_missing_state_cookie_redirects_with_error(
        self, oauth_client: httpx.AsyncClient
    ) -> None:
        response = await oauth_client.get(
            "/v1/auth/github/callback",
            params={"code": "the-code", "state": "anything"},
        )

        assert response.status_code == 303
        assert _query_params(response)["error"] == ["Missing OAuth2 state cookie"]

    async def test_cookie_path_advances_session(
        self,
        oauth_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user_github_oauth: OAuthAccount,
    ) -> None:
        with respx.mock(assert_all_mocked=False) as mock:
            _mock_github(mock)
            state, auth_token = await _start_and_authorize(oauth_client)

            response = await oauth_client.get(
                "/v1/auth/github/callback",
                params={"code": "the-code", "state": state},
            )

        assert response.status_code == 303
        assert "error" not in _query_params(response)

        auth_session = await _refresh_auth_session(session, auth_token)
        assert auth_session.identity_id == user_github_oauth.user_id
        assert "github" in auth_session.used_factors
        assert auth_session.step == 1

    async def test_recovery_valid_session_advances(
        self,
        oauth_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user_github_oauth: OAuthAccount,
    ) -> None:
        with respx.mock(assert_all_mocked=False) as mock:
            _mock_github(mock)
            state, auth_token = await _start_and_authorize(oauth_client)

            # Simulate a POST/same-site callback that does not carry the
            # auth-session cookie: the recovery branch must resolve the session
            # from the token hash stored in the OAuth2 state context.
            oauth_client.cookies.delete(settings.AUTHENTICATION_SESSION_COOKIE_KEY)

            response = await oauth_client.get(
                "/v1/auth/github/callback",
                params={"code": "the-code", "state": state},
            )

        assert response.status_code == 303
        assert "error" not in _query_params(response)

        auth_session = await _refresh_auth_session(session, auth_token)
        assert auth_session.identity_id == user_github_oauth.user_id
        assert "github" in auth_session.used_factors
        assert auth_session.step == 1

    async def test_recovery_expired_session_redirects_with_error(
        self,
        oauth_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user_github_oauth: OAuthAccount,
    ) -> None:
        with respx.mock(assert_all_mocked=False) as mock:
            _mock_github(mock)
            state, auth_token = await _start_and_authorize(oauth_client)

            await _expire_auth_session(session, auth_token)
            oauth_client.cookies.delete(settings.AUTHENTICATION_SESSION_COOKIE_KEY)

            response = await oauth_client.get(
                "/v1/auth/github/callback",
                params={"code": "the-code", "state": state},
            )

        assert response.status_code == 303
        assert _query_params(response)["error"] == ["No active authentication session"]

        auth_session = await _refresh_auth_session(session, auth_token)
        # The expired session must NOT have been advanced by the recovery branch.
        assert "github" not in auth_session.used_factors
        assert auth_session.step == 0
        assert auth_session.identity_id is None

    async def test_recovery_unknown_token_hash_redirects_with_error(
        self,
        oauth_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        user_github_oauth: OAuthAccount,
    ) -> None:
        with respx.mock(assert_all_mocked=False) as mock:
            _mock_github(mock)
            state, auth_token = await _start_and_authorize(oauth_client)

            oauth_client.cookies.delete(settings.AUTHENTICATION_SESSION_COOKIE_KEY)
            # Remove the auth-session row so the token hash in the state context
            # no longer resolves to a session.
            auth_session = await _refresh_auth_session(session, auth_token)
            await session.delete(auth_session)
            await session.flush()

            response = await oauth_client.get(
                "/v1/auth/github/callback",
                params={"code": "the-code", "state": state},
            )

        assert response.status_code == 303
        assert _query_params(response)["error"] == ["No active authentication session"]
