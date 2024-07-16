import time
import uuid
from collections.abc import Callable
from typing import Any

import jwt
import pytest
from authlib.jose import JsonWebKey
from authlib.oauth2.rfc6749 import OAuth2Request
from authlib.oauth2.rfc6749.errors import (
    InvalidGrantError,
    InvalidRequestError,
    InvalidScopeError,
)
from sqlalchemy import select

from polar.config import settings
from polar.kit.crypto import get_token_hash
from polar.kit.db.postgres import Session
from polar.models import OAuth2Token, Organization
from polar.oauth2.authorization_server import AuthorizationServer
from polar.oauth2.grants.github_oidc_id_token import GitHubOIDCIDTokenGrant
from polar.oauth2.sub_type import SubType
from tests.fixtures.database import SaveFixture


def _generate_id_token(jwk: jwt.PyJWK, data: dict[str, Any] | None = None) -> str:
    return jwt.encode(
        {
            "jti": str(uuid.uuid4()),
            "sub": "repo",
            "aud": "polar",
            "iss": "https://token.actions.githubusercontent.com",
            "exp": int(time.time()) + 60,
            "repository_owner_id": 123,
            "repository_owner": "polarsource",
            "actor_id": 456,
            "actor": "frankie567",
            **(data or {}),
        },
        jwk.key,
        algorithm="RS256",
        headers={"kid": jwk.key_id},
    )


def _build_request(body: dict[str, Any]) -> OAuth2Request:
    return OAuth2Request("POST", "https://example.com/token", body)


class MockPyJWKClient(jwt.PyJWKClient):
    def __init__(self, key: jwt.PyJWK) -> None:
        super().__init__("")
        self.key = key

    def get_signing_key(self, kid: str) -> jwt.PyJWK:
        if kid == self.key.key_id:
            return self.key
        raise jwt.PyJWKClientError()


_jwk = JsonWebKey.generate_key(
    "RSA", 2048, {"kid": "TEST_KEY", "use": "sig"}, is_private=True
)
PRIVATE_JWK = jwt.PyJWK.from_dict(_jwk.as_dict(is_private=True))
PUBLIC_JWK = jwt.PyJWK.from_dict(_jwk.as_dict(is_private=False))
MOCK_PYJWK_CLIENT = MockPyJWKClient(PUBLIC_JWK)


@pytest.fixture
def authorization_server(sync_session: Session) -> AuthorizationServer:
    return AuthorizationServer(sync_session)


GetGrant = Callable[[OAuth2Request], GitHubOIDCIDTokenGrant]


@pytest.fixture
def get_grant(authorization_server: AuthorizationServer) -> GetGrant:
    def _get_grant(request: OAuth2Request) -> GitHubOIDCIDTokenGrant:
        return GitHubOIDCIDTokenGrant(request, authorization_server, MOCK_PYJWK_CLIENT)

    return _get_grant


class TestValidateTokenRequest:
    def test_missing_id_token(self, get_grant: GetGrant) -> None:
        request = _build_request(
            {"grant_type": "github_oidc_id_token", "scope": "openid"}
        )
        grant = get_grant(request)
        with pytest.raises(InvalidRequestError):
            grant.validate_token_request()

    def test_missing_scope(self, get_grant: GetGrant) -> None:
        request = _build_request(
            {"grant_type": "github_oidc_id_token", "id_token": "ID_TOKEN"}
        )
        grant = get_grant(request)
        with pytest.raises(InvalidRequestError):
            grant.validate_token_request()

    def test_invalid_scope(self, get_grant: GetGrant) -> None:
        request = _build_request(
            {
                "grant_type": "github_oidc_id_token",
                "id_token": "ID_TOKEN",
                "scope": "INVALID_SCOPE",
            }
        )
        grant = get_grant(request)
        with pytest.raises(InvalidScopeError):
            grant.validate_token_request()

    def test_invalid_id_token(self, get_grant: GetGrant) -> None:
        request = _build_request(
            {
                "grant_type": "github_oidc_id_token",
                "id_token": "ID_TOKEN",
                "scope": "openid",
            }
        )
        grant = get_grant(request)
        with pytest.raises(InvalidGrantError):
            grant.validate_token_request()

    def test_not_existing_organization(self, get_grant: GetGrant) -> None:
        id_token = _generate_id_token(PRIVATE_JWK, {"repository_owner": "not_existing"})
        request = _build_request(
            {
                "grant_type": "github_oidc_id_token",
                "id_token": id_token,
                "scope": "openid",
            }
        )
        grant = get_grant(request)
        with pytest.raises(InvalidGrantError):
            grant.validate_token_request()

    def test_valid(self, get_grant: GetGrant, organization: Organization) -> None:
        id_token = _generate_id_token(
            PRIVATE_JWK,
            {
                "repository_owner": organization.slug,
                "repository_owner_id": organization.external_id,
            },
        )
        request = _build_request(
            {
                "grant_type": "github_oidc_id_token",
                "id_token": id_token,
                "scope": "openid",
            }
        )
        grant = get_grant(request)

        grant.validate_token_request()

        assert request.user == (SubType.organization, organization)
        assert request.client is not None

    @pytest.mark.asyncio
    async def test_nonce_exists(
        self, save_fixture: SaveFixture, get_grant: GetGrant, organization: Organization
    ) -> None:
        nonce = "NONCE_VALUE"
        oauth2_token = OAuth2Token(
            client_id="https://token.actions.githubusercontent.com",
            token_type="Bearer",
            access_token="ACCESS_TOKEN",
            sub_type=SubType.organization,
            organization=organization,
            nonce=nonce,
        )
        await save_fixture(oauth2_token)

        id_token = _generate_id_token(
            PRIVATE_JWK,
            {
                "jti": nonce,
                "repository_owner": organization.slug,
                "repository_owner_id": organization.external_id,
            },
        )
        request = _build_request(
            {
                "grant_type": "github_oidc_id_token",
                "id_token": id_token,
                "scope": "openid",
            }
        )
        grant = get_grant(request)

        with pytest.raises(InvalidGrantError):
            grant.validate_token_request()


class TestCreateTokenResponse:
    def test_valid(
        self, sync_session: Session, get_grant: GetGrant, organization: Organization
    ) -> None:
        jti = "ID_TOKEN_JTI"
        exp = int(time.time()) + 60
        id_token = _generate_id_token(
            PRIVATE_JWK,
            {
                "jti": jti,
                "exp": exp,
                "repository_owner": organization.slug,
                "repository_owner_id": organization.external_id,
            },
        )
        request = _build_request(
            {
                "grant_type": "github_oidc_id_token",
                "id_token": id_token,
                "scope": "openid",
            }
        )
        grant = get_grant(request)

        grant.validate_token_request()
        status_code, body, _ = grant.create_token_response()

        assert status_code == 200
        assert "access_token" in body
        assert "nonce" not in body

        access_token = body["access_token"]
        access_token_hash = get_token_hash(access_token, secret=settings.SECRET)
        result = sync_session.execute(
            select(OAuth2Token).where(OAuth2Token.access_token == access_token_hash)
        )
        access_token_object = result.unique().scalar_one_or_none()
        assert access_token_object is not None
        assert access_token_object.nonce == jti
        assert access_token_object.expires_in == exp - int(time.time())  # pyright: ignore
