from collections.abc import AsyncIterator
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
import respx
from cryptography.hazmat.primitives.asymmetric import rsa
from pydantic import SecretStr
from sqlalchemy import select
from starlette.applications import Starlette

from polar.auth.service import auth as auth_service
from polar.backoffice import app as backoffice_app
from polar.backoffice.auth.factor import GOOGLE_DISCOVERY_ENDPOINT
from polar.config import settings
from polar.kit.utils import utc_now
from polar.models import BackofficeUser, BackofficeUserSession, User
from polar.postgres import AsyncSession, get_db_session


@pytest.fixture
async def client(
    session: AsyncSession, monkeypatch: pytest.MonkeyPatch
) -> AsyncIterator[httpx.AsyncClient]:
    monkeypatch.setattr(settings, "BASE_URL", "http://localhost")
    monkeypatch.setattr(settings, "BACKOFFICE_HOST", None)
    monkeypatch.setattr(settings, "BACKOFFICE_GOOGLE_CLIENT_ID", "backoffice-client")
    monkeypatch.setattr(
        settings, "BACKOFFICE_GOOGLE_CLIENT_SECRET", SecretStr("client-secret")
    )
    monkeypatch.setattr(settings, "BACKOFFICE_GOOGLE_HOSTED_DOMAIN", "polar.sh")
    monkeypatch.setitem(
        backoffice_app.dependency_overrides, get_db_session, lambda: session
    )
    app = Starlette()
    app.mount("/backoffice", backoffice_app)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://localhost"
    ) as client:
        yield client


@pytest.fixture
def claims(respx_mock: respx.MockRouter) -> dict[str, object]:
    issuer = "https://accounts.google.com"
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = jwt.get_algorithm_by_name("RS256").to_jwk(
        key.public_key(), as_dict=True
    )
    now = int(utc_now().timestamp())
    claims: dict[str, object] = {
        "iss": issuer,
        "aud": "backoffice-client",
        "exp": now + 3600,
        "iat": now,
        "email": "staff@polar.sh",
        "email_verified": True,
        "hd": "polar.sh",
        "sub": "google-subject",
    }
    respx_mock.get(GOOGLE_DISCOVERY_ENDPOINT).respond(
        json={
            "issuer": issuer,
            "authorization_endpoint": f"{issuer}/auth",
            "token_endpoint": "https://oauth2.googleapis.com/token",
            "jwks_uri": f"{issuer}/jwks",
            "id_token_signing_alg_values_supported": ["RS256"],
            "token_endpoint_auth_methods_supported": ["client_secret_post"],
        }
    )
    respx_mock.get(f"{issuer}/jwks").respond(
        json={"keys": [{**public_key, "kid": "test-key", "alg": "RS256"}]}
    )

    def exchange(request: httpx.Request) -> httpx.Response:
        data = parse_qs(request.content.decode())
        assert data["client_id"] == ["backoffice-client"]
        assert data["client_secret"] == ["client-secret"]
        assert data["redirect_uri"] == ["http://localhost/backoffice/auth/callback"]
        assert data["code_verifier"]
        return httpx.Response(
            200,
            json={
                "access_token": "google-access-token",
                "expires_in": 3600,
                "id_token": jwt.encode(
                    claims, key, algorithm="RS256", headers={"kid": "test-key"}
                ),
            },
        )

    respx_mock.post("https://oauth2.googleapis.com/token").mock(side_effect=exchange)
    return claims


async def start_login(client: httpx.AsyncClient, claims: dict[str, object]) -> str:
    response = await client.get("/backoffice/auth/")
    assert response.status_code == 303
    params = parse_qs(urlsplit(response.headers["location"]).query)
    assert params["client_id"] == ["backoffice-client"]
    assert params["redirect_uri"] == ["http://localhost/backoffice/auth/callback"]
    assert params["code_challenge_method"] == ["S256"]
    claims["nonce"] = params["nonce"][0]
    return params["state"][0]


@pytest.mark.anyio
@pytest.mark.respx(assert_all_called=False)
class TestGoogleLogin:
    async def test_provision_reuse_and_logout(
        self,
        client: httpx.AsyncClient,
        session: AsyncSession,
        claims: dict[str, object],
    ) -> None:
        state = await start_login(client, claims)
        params = {"state": state, "code": "google-code"}
        response = await client.get("/backoffice/auth/callback", params=params)
        assert response.status_code == 303
        assert settings.AUTHENTICATION_SESSION_COOKIE_KEY not in client.cookies
        assert settings.USER_SESSION_COOKIE_KEY not in client.cookies
        assert (
            settings.BACKOFFICE_AUTHENTICATION_SESSION_COOKIE_KEY not in client.cookies
        )
        token = client.cookies[settings.BACKOFFICE_USER_SESSION_COOKIE_KEY]
        user = (await session.scalars(select(BackofficeUser))).one()
        assert user.provider_id == "google-subject"
        assert user.email == "staff@polar.sh"
        user_id = user.id
        response = await client.get("/backoffice/auth/")
        assert response.status_code == 303
        assert response.headers["location"] == "http://localhost/backoffice/"
        assert "set-cookie" not in response.headers
        assert (await client.get("/backoffice/")).status_code == 200
        assert (
            await client.get("/backoffice/auth/callback", params=params)
        ).status_code == 401

        user_session = (await session.scalars(select(BackofficeUserSession))).one()
        user_session.expires_at = utc_now()
        await session.flush()

        claims["email"] = "renamed@polar.sh"
        response = await client.get(
            "/backoffice/auth/callback",
            params={"state": await start_login(client, claims), "code": "google-code"},
        )
        assert response.status_code == 303
        assert client.cookies[settings.BACKOFFICE_USER_SESSION_COOKIE_KEY] != token
        session.expire_all()
        user = (await session.scalars(select(BackofficeUser))).one()
        assert user.id == user_id
        assert user.email == "renamed@polar.sh"
        assert len((await session.scalars(select(BackofficeUserSession))).all()) == 1

        response = await client.get(
            "/backoffice/auth/logout", headers={"Sec-Fetch-Site": "cross-site"}
        )
        assert response.status_code == 403

        response = await client.get(
            "/backoffice/auth/logout",
            headers={"Sec-Fetch-Site": "same-origin"},
        )
        assert response.status_code == 303
        assert settings.BACKOFFICE_USER_SESSION_COOKIE_KEY not in client.cookies
        assert (await session.scalars(select(BackofficeUserSession))).first() is None

    async def test_dashboard_admin_session_does_not_authorize_backoffice(
        self, client: httpx.AsyncClient, session: AsyncSession, user: User
    ) -> None:
        user.is_admin = True
        token, _ = await auth_service._create_user_session(
            session, user, user_agent="tests", scopes=[]
        )
        client.cookies.set(settings.USER_SESSION_COOKIE_KEY, token)

        response = await client.get("/backoffice/")
        assert response.status_code == 303
        assert response.headers["location"] == "http://localhost/backoffice/auth/"

        response = await client.get("/backoffice/", headers={"HX-Request": "true"})
        assert response.status_code == 401
        assert response.headers["HX-Redirect"] == "http://localhost/backoffice/auth/"

    @pytest.mark.parametrize(
        ("existing_provider_id", "expected_status"),
        [(None, 303), ("other-subject", 409)],
    )
    async def test_links_preexisting_staff_by_email(
        self,
        client: httpx.AsyncClient,
        session: AsyncSession,
        claims: dict[str, object],
        existing_provider_id: str | None,
        expected_status: int,
    ) -> None:
        staff = BackofficeUser(email="STAFF@polar.sh", provider_id=existing_provider_id)
        session.add(staff)
        await session.flush()

        state = await start_login(client, claims)
        response = await client.get(
            "/backoffice/auth/callback", params={"state": state, "code": "google-code"}
        )
        assert response.status_code == expected_status
        assert (await session.scalars(select(BackofficeUser))).one() == staff
        assert staff.provider_id == (existing_provider_id or "google-subject")
        assert (settings.BACKOFFICE_USER_SESSION_COOKIE_KEY in client.cookies) == (
            expected_status == 303
        )

    async def test_callback_rejects_state_from_another_flow(
        self, client: httpx.AsyncClient, claims: dict[str, object]
    ) -> None:
        old_state = await start_login(client, claims)
        await start_login(client, claims)
        response = await client.get(
            "/backoffice/auth/callback", params={"state": old_state, "code": "code"}
        )
        assert response.status_code == 401
        assert settings.BACKOFFICE_USER_SESSION_COOKIE_KEY not in client.cookies

    @pytest.mark.parametrize(
        ("claim", "value"),
        [("hd", None), ("hd", "other.test"), ("email_verified", False)],
    )
    async def test_rejects_ineligible_claims(
        self,
        client: httpx.AsyncClient,
        session: AsyncSession,
        claims: dict[str, object],
        claim: str,
        value: object,
    ) -> None:
        claims[claim] = value
        response = await client.get(
            "/backoffice/auth/callback",
            params={"state": await start_login(client, claims), "code": "google-code"},
        )
        assert response.status_code == 403
        assert (await session.scalars(select(BackofficeUser))).first() is None
        assert settings.BACKOFFICE_USER_SESSION_COOKIE_KEY not in client.cookies

    @pytest.mark.parametrize("claim", ["aud", "nonce"])
    async def test_rejects_invalid_id_token(
        self, client: httpx.AsyncClient, claims: dict[str, object], claim: str
    ) -> None:
        state = await start_login(client, claims)
        claims[claim] = "invalid"
        response = await client.get(
            "/backoffice/auth/callback", params={"state": state, "code": "google-code"}
        )
        assert response.status_code == 401
        assert settings.BACKOFFICE_USER_SESSION_COOKIE_KEY not in client.cookies

    async def test_session_survives_hash_secret_rotation(
        self,
        client: httpx.AsyncClient,
        session: AsyncSession,
        claims: dict[str, object],
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setattr(
            settings, "HASH_SECRETS", {"v1": "secret1", "v2": "secret2"}
        )
        monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "v1")
        response = await client.get(
            "/backoffice/auth/callback",
            params={"state": await start_login(client, claims), "code": "google-code"},
        )
        assert response.status_code == 303
        assert (
            (await session.scalars(select(BackofficeUserSession)))
            .one()
            .token_hash.startswith("v1$")
        )

        monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "v2")
        response = await client.get("/backoffice/auth/")
        assert response.status_code == 303
        assert response.headers["location"] == "http://localhost/backoffice/"
        assert "set-cookie" not in response.headers
        assert (
            (await session.scalars(select(BackofficeUserSession)))
            .one()
            .token_hash.startswith("v2$")
        )
