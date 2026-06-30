import uuid

import pytest

from polar.auth.oauth2.state import OAuth2StateService
from polar.auth.sso.factor import (
    SSOClientSecretFactor,
    SSOPrivateKeyJWTFactor,
    build_sso_factor,
)
from polar.config import settings
from polar.models import OrganizationSSOConnection
from polar.models.organization_sso_connection import (
    OIDCAuthMethod,
    OIDCConfiguration,
    OrganizationSSOConnectionType,
)
from polar.postgres import AsyncSession


def build_connection(
    configuration: OIDCConfiguration,
) -> OrganizationSSOConnection:
    return OrganizationSSOConnection(
        id=uuid.uuid4(),
        organization_id=uuid.uuid4(),
        type=OrganizationSSOConnectionType.oidc,
        configuration=configuration,
        enabled=True,
    )


@pytest.mark.asyncio
class TestBuildSSOFactor:
    async def test_client_secret(self, session: AsyncSession) -> None:
        connection = build_connection(
            {
                "issuer": "https://idp.example.com",
                "client_id": "client-id",
                "auth_method": OIDCAuthMethod.client_secret,
                "client_secret": "secret",
            }
        )

        factor = build_sso_factor(connection, state_service=OAuth2StateService(session))

        assert isinstance(factor, SSOClientSecretFactor)
        assert factor.identifier == str(connection.id)
        assert factor.client_id == "client-id"
        assert (
            factor.DISCOVERY_ENDPOINT
            == "https://idp.example.com/.well-known/openid-configuration"
        )

    async def test_private_key_jwt(self, session: AsyncSession) -> None:
        connection = build_connection(
            {
                "issuer": "https://idp.example.com",
                "client_id": "client-id",
                "auth_method": OIDCAuthMethod.private_key_jwt,
            }
        )

        factor = build_sso_factor(connection, state_service=OAuth2StateService(session))

        assert isinstance(factor, SSOPrivateKeyJWTFactor)
        assert factor.identifier == str(connection.id)
        assert factor.client_id == "client-id"
        assert factor._kid == settings.CURRENT_JWK_KID
        assert factor._signing_jwks[settings.CURRENT_JWK_KID] is not None

    async def test_issuer_trailing_slash_is_stripped(
        self, session: AsyncSession
    ) -> None:
        connection = build_connection(
            {
                "issuer": "https://idp.example.com/",
                "client_id": "client-id",
                "auth_method": OIDCAuthMethod.client_secret,
                "client_secret": "secret",
            }
        )

        factor = build_sso_factor(connection, state_service=OAuth2StateService(session))

        assert (
            factor.DISCOVERY_ENDPOINT
            == "https://idp.example.com/.well-known/openid-configuration"
        )
