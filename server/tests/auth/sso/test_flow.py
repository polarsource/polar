import base64
from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import parse_qs, urlsplit

import httpx
import jwt
import pytest
import pytest_asyncio
import respx
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from sqlalchemy import select

from polar.kit.utils import utc_now
from polar.models import (
    OAuth2State,
    Organization,
    OrganizationSSOConnection,
    User,
    UserOrganization,
    UserSession,
    UserSessionOrganization,
)
from polar.models.organization_sso_connection import (
    OIDCAuthMethod,
    OIDCConfiguration,
    OrganizationSSOConnectionType,
)
from polar.models.user_organization import OrganizationRole
from polar.postgres import AsyncSession
from tests.fixtures.base import IsolatedSessionTestClient
from tests.fixtures.database import SaveFixture

ISSUER = "https://idp.example.test"
CLIENT_ID = "client-id"
KID = "idp-key-1"
ACCESS_TOKEN = "idp-access-token"


@pytest.fixture
def idp_key() -> rsa.RSAPrivateKey:
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest_asyncio.fixture
async def sso_client(
    app: FastAPI, session: AsyncSession
) -> AsyncIterator[httpx.AsyncClient]:
    # A 127.0.0.1 base URL keeps the session/state cookies non-Secure so httpx
    # carries them across the redirect hops over plain http.
    async with IsolatedSessionTestClient(
        session=session,
        auto_expunge=False,
        transport=httpx.ASGITransport(app=app),
        base_url="http://127.0.0.1",
    ) as client:
        yield client


def _public_jwks(key: rsa.RSAPrivateKey) -> dict[str, Any]:
    algorithm = jwt.get_algorithm_by_name("RS256")
    return {
        "keys": [
            {
                **algorithm.to_jwk(key.public_key(), as_dict=True),
                "kid": KID,
                "use": "sig",
                "alg": "RS256",
            }
        ]
    }


def _discovery_document() -> dict[str, Any]:
    return {
        "issuer": ISSUER,
        "authorization_endpoint": f"{ISSUER}/authorize",
        "token_endpoint": f"{ISSUER}/token",
        "jwks_uri": f"{ISSUER}/jwks",
        "id_token_signing_alg_values_supported": ["RS256"],
        "token_endpoint_auth_methods_supported": ["client_secret_post"],
    }


def _id_token(
    key: rsa.RSAPrivateKey, *, nonce: str, email: str, email_verified: bool = True
) -> str:
    issued_at = int(utc_now().timestamp())
    digest = hashes.Hash(hashes.SHA256())
    digest.update(ACCESS_TOKEN.encode())
    at_hash = base64.urlsafe_b64encode(digest.finalize()[:16]).rstrip(b"=").decode()
    return jwt.encode(
        {
            "iss": ISSUER,
            "sub": "idp-subject",
            "aud": CLIENT_ID,
            "exp": issued_at + 3600,
            "iat": issued_at,
            "nonce": nonce,
            "at_hash": at_hash,
            "email": email,
            "email_verified": email_verified,
        },
        key,
        algorithm="RS256",
        headers={"kid": KID},
    )


async def create_sso_connection(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    authorization_parameters: dict[str, str] | None = None,
) -> OrganizationSSOConnection:
    configuration: OIDCConfiguration = {
        "issuer": ISSUER,
        "client_id": CLIENT_ID,
        "auth_method": OIDCAuthMethod.client_secret,
        "client_secret": "secret",
    }
    if authorization_parameters is not None:
        configuration["authorization_parameters"] = authorization_parameters
    organization.feature_settings = {
        **organization.feature_settings,
        "sso_enabled": True,
    }
    await save_fixture(organization)
    connection = OrganizationSSOConnection(
        organization=organization,
        type=OrganizationSSOConnectionType.oidc,
        configuration=configuration,
        enabled=True,
    )
    await save_fixture(connection)
    return connection


def _state_from_redirect(response: httpx.Response) -> str:
    query = urlsplit(response.headers["location"]).query
    return parse_qs(query)["state"][0]


async def drive_to_callback(
    client: httpx.AsyncClient,
    session: AsyncSession,
    mock: respx.MockRouter,
    idp_key: rsa.RSAPrivateKey,
    *,
    slug: str,
    connection_id: object,
    email: str,
    email_verified: bool = True,
) -> httpx.Response:
    """Run start → authorize → callback against the mock IdP, returning the
    callback response (a redirect to the frontend on success, or an error
    redirect on rejection)."""
    mock.get(f"{ISSUER}/.well-known/openid-configuration").mock(
        return_value=httpx.Response(200, json=_discovery_document())
    )
    mock.get(f"{ISSUER}/jwks").mock(
        return_value=httpx.Response(200, json=_public_jwks(idp_key))
    )

    start = await client.post(f"/v1/auth/{slug}/start", json={})
    assert start.status_code == 201

    authorize = await client.get(f"/v1/auth/{slug}/sso/{connection_id}/authorize")
    assert authorize.status_code == 303
    state = _state_from_redirect(authorize)

    result = await session.execute(
        select(OAuth2State).where(OAuth2State.provider == str(connection_id))
    )
    nonce = result.scalar_one().nonce
    assert nonce is not None

    mock.post(f"{ISSUER}/token").mock(
        return_value=httpx.Response(
            200,
            json={
                "access_token": ACCESS_TOKEN,
                "expires_in": 3600,
                "id_token": _id_token(
                    idp_key, nonce=nonce, email=email, email_verified=email_verified
                ),
            },
        )
    )

    return await client.get(
        f"/v1/auth/{slug}/sso/callback",
        params={"code": "the-code", "state": state},
    )


async def _user_session_count(session: AsyncSession, user: User) -> int:
    result = await session.execute(
        select(UserSession).where(UserSession.user_id == user.id)
    )
    return len(result.scalars().unique().all())


async def _get_user_by_email(session: AsyncSession, email: str) -> User | None:
    result = await session.execute(select(User).where(User.email == email))
    return result.scalars().unique().one_or_none()


async def _get_membership(
    session: AsyncSession, user: User, organization: Organization
) -> UserOrganization | None:
    result = await session.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == user.id,
            UserOrganization.organization_id == organization.id,
        )
    )
    return result.scalars().unique().one_or_none()


@pytest.mark.asyncio
class TestSSOAuthorize:
    async def test_authorization_parameters_are_appended(
        self,
        sso_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
    ) -> None:
        connection = await create_sso_connection(
            save_fixture, organization, authorization_parameters={"hd": "polar.sh"}
        )

        with respx.mock(assert_all_mocked=False) as mock:
            mock.get(f"{ISSUER}/.well-known/openid-configuration").mock(
                return_value=httpx.Response(200, json=_discovery_document())
            )
            await sso_client.post(f"/v1/auth/{organization.slug}/start", json={})
            authorize = await sso_client.get(
                f"/v1/auth/{organization.slug}/sso/{connection.id}/authorize"
            )

        assert authorize.status_code == 303
        query = parse_qs(urlsplit(authorize.headers["location"]).query)
        assert query["hd"] == ["polar.sh"]
        assert query["client_id"] == [CLIENT_ID]


@pytest.mark.asyncio
class TestSSOLoginFlow:
    async def test_login_mints_session_scoped_to_organization(
        self,
        sso_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        idp_key: rsa.RSAPrivateKey,
    ) -> None:
        connection = await create_sso_connection(save_fixture, organization)

        with respx.mock(assert_all_mocked=False) as mock:
            callback = await drive_to_callback(
                sso_client,
                session,
                mock,
                idp_key,
                slug=organization.slug,
                connection_id=connection.id,
                email=user.email,
            )
            assert callback.status_code == 303
            assert f"/auth/sso/{organization.slug}" in callback.headers["location"]

            await sso_client.get(f"/v1/auth/{organization.slug}/complete")

        user_session = (
            (
                await session.execute(
                    select(UserSession).where(UserSession.user_id == user.id)
                )
            )
            .scalars()
            .unique()
            .one()
        )
        scopes = (
            (
                await session.execute(
                    select(UserSessionOrganization).where(
                        UserSessionOrganization.user_session_id == user_session.id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert [scope.organization_id for scope in scopes] == [organization.id]

    async def test_global_complete_keeps_sso_session_scoped(
        self,
        sso_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        idp_key: rsa.RSAPrivateKey,
    ) -> None:
        # Completing through the global /complete (as the shared TOTP/backup-codes
        # pages do) must still mint an org-scoped session for an SSO login.
        connection = await create_sso_connection(save_fixture, organization)

        with respx.mock(assert_all_mocked=False) as mock:
            callback = await drive_to_callback(
                sso_client,
                session,
                mock,
                idp_key,
                slug=organization.slug,
                connection_id=connection.id,
                email=user.email,
            )
            assert callback.status_code == 303

            await sso_client.get("/v1/auth/complete")

        user_session = (
            (
                await session.execute(
                    select(UserSession).where(UserSession.user_id == user.id)
                )
            )
            .scalars()
            .unique()
            .one()
        )
        scopes = (
            (
                await session.execute(
                    select(UserSessionOrganization).where(
                        UserSessionOrganization.user_session_id == user_session.id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert [scope.organization_id for scope in scopes] == [organization.id]

    async def test_rejects_unverified_email(
        self,
        sso_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        idp_key: rsa.RSAPrivateKey,
    ) -> None:
        connection = await create_sso_connection(save_fixture, organization)

        with respx.mock(assert_all_mocked=False) as mock:
            callback = await drive_to_callback(
                sso_client,
                session,
                mock,
                idp_key,
                slug=organization.slug,
                connection_id=connection.id,
                email=user.email,
                email_verified=False,
            )

        assert "error=" in callback.headers["location"]
        assert await _user_session_count(session, user) == 0

    async def test_rejects_when_membership_revoked_before_complete(
        self,
        sso_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        idp_key: rsa.RSAPrivateKey,
    ) -> None:
        connection = await create_sso_connection(save_fixture, organization)

        with respx.mock(assert_all_mocked=False) as mock:
            callback = await drive_to_callback(
                sso_client,
                session,
                mock,
                idp_key,
                slug=organization.slug,
                connection_id=connection.id,
                email=user.email,
            )
            assert callback.status_code == 303

            # Membership is revoked between the callback and completion.
            await session.delete(user_organization)
            await session.flush()

            complete = await sso_client.get(f"/v1/auth/{organization.slug}/complete")
            assert "error=" in complete.headers["location"]

        assert await _user_session_count(session, user) == 0

    async def test_rejects_session_bound_to_other_organization(
        self,
        sso_client: httpx.AsyncClient,
        organization: Organization,
        organization_second: Organization,
    ) -> None:
        # The session is bound to `organization` at start.
        start = await sso_client.post(f"/v1/auth/{organization.slug}/start", json={})
        assert start.status_code == 201

        # Driving it to a different organization's endpoint is rejected.
        complete = await sso_client.get(f"/v1/auth/{organization_second.slug}/complete")
        assert "error=" in complete.headers["location"]


NEWCOMER_EMAIL = "newcomer@example.test"


@pytest.mark.asyncio
class TestSSOJITProvisioning:
    async def test_provisions_unknown_email(
        self,
        sso_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        idp_key: rsa.RSAPrivateKey,
    ) -> None:
        connection = await create_sso_connection(save_fixture, organization)

        with respx.mock(assert_all_mocked=False) as mock:
            callback = await drive_to_callback(
                sso_client,
                session,
                mock,
                idp_key,
                slug=organization.slug,
                connection_id=connection.id,
                email=NEWCOMER_EMAIL,
            )
            assert callback.status_code == 303

            await sso_client.get(f"/v1/auth/{organization.slug}/complete")

        user = await _get_user_by_email(session, NEWCOMER_EMAIL)
        assert user is not None
        assert user.email_verified is True

        membership = await _get_membership(session, user, organization)
        assert membership is not None
        assert membership.role == OrganizationRole.member

        user_session = (
            (
                await session.execute(
                    select(UserSession).where(UserSession.user_id == user.id)
                )
            )
            .scalars()
            .unique()
            .one()
        )
        scopes = (
            (
                await session.execute(
                    select(UserSessionOrganization).where(
                        UserSessionOrganization.user_session_id == user_session.id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert [scope.organization_id for scope in scopes] == [organization.id]

    async def test_provisions_existing_user_without_membership(
        self,
        sso_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user_second: User,
        idp_key: rsa.RSAPrivateKey,
    ) -> None:
        connection = await create_sso_connection(save_fixture, organization)

        with respx.mock(assert_all_mocked=False) as mock:
            callback = await drive_to_callback(
                sso_client,
                session,
                mock,
                idp_key,
                slug=organization.slug,
                connection_id=connection.id,
                email=user_second.email,
            )
            assert callback.status_code == 303

            await sso_client.get(f"/v1/auth/{organization.slug}/complete")

        membership = await _get_membership(session, user_second, organization)
        assert membership is not None
        assert membership.role == OrganizationRole.member

    async def test_keeps_existing_member_role(
        self,
        sso_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        user: User,
        user_organization: UserOrganization,
        idp_key: rsa.RSAPrivateKey,
    ) -> None:
        user_organization.role = OrganizationRole.admin
        await save_fixture(user_organization)

        connection = await create_sso_connection(save_fixture, organization)

        with respx.mock(assert_all_mocked=False) as mock:
            callback = await drive_to_callback(
                sso_client,
                session,
                mock,
                idp_key,
                slug=organization.slug,
                connection_id=connection.id,
                email=user.email,
            )
            assert callback.status_code == 303

        membership = await _get_membership(session, user, organization)
        assert membership is not None
        assert membership.role == OrganizationRole.admin

    async def test_rejects_unverified_email_before_provisioning(
        self,
        sso_client: httpx.AsyncClient,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
        idp_key: rsa.RSAPrivateKey,
    ) -> None:
        connection = await create_sso_connection(save_fixture, organization)

        with respx.mock(assert_all_mocked=False) as mock:
            callback = await drive_to_callback(
                sso_client,
                session,
                mock,
                idp_key,
                slug=organization.slug,
                connection_id=connection.id,
                email=NEWCOMER_EMAIL,
                email_verified=False,
            )

        assert "error=" in callback.headers["location"]
        assert await _get_user_by_email(session, NEWCOMER_EMAIL) is None
