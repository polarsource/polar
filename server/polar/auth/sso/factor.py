import uuid
from typing import Any, cast

import jwt
from reauth.factors.oauth2.base import OAuth2Enrollment as OAuth2EnrollmentDataclass
from reauth.factors.oauth2.oidc import (
    OIDCExtraParams,
    OIDCFactor,
    OIDCFactorBase,
    PrivateKeyJWTOIDCFactor,
)

from polar.config import settings
from polar.models import OrganizationSSOConnection
from polar.models.organization_sso_connection import OIDCAuthMethod
from polar.sso.schemas import DISCOVERY_PATH

from ..oauth2.state import OAuth2StateService


def _discovery_endpoint(issuer: str) -> str:
    return f"{issuer.rstrip('/')}{DISCOVERY_PATH}"


class SSOFactorMixin(OIDCFactorBase):
    """Shared behavior for organization SSO OIDC factors.

    An SSO login resolves the user from the verified `id_token` email and never
    persists an enrollment, so the storage hooks go unused: enrollment lookups
    return `None` (steering reauth's callback to its identity-less path) and the
    write hooks are never reached.
    """

    connection_id: uuid.UUID
    organization_slug: str
    name: str | None
    authorization_parameters: dict[str, str]

    async def get_authorization_url(
        self, *, extra: OIDCExtraParams | None = None, **kwargs: Any
    ) -> str:
        merged = {**self.authorization_parameters, **(extra or {})}
        return await super().get_authorization_url(
            extra=cast(OIDCExtraParams, merged) if merged else None,
            **kwargs,
        )

    async def get_enrollment(
        self, identity_id: uuid.UUID
    ) -> OAuth2EnrollmentDataclass | None:
        return None

    async def get_enrollment_by_provider_and_account(
        self, provider: str, account_id: str
    ) -> OAuth2EnrollmentDataclass | None:
        return None

    async def insert(self, enrollment: OAuth2EnrollmentDataclass) -> uuid.UUID:
        raise NotImplementedError()

    async def update(self, enrollment: OAuth2EnrollmentDataclass) -> None:
        raise NotImplementedError()


class SSOClientSecretFactor(SSOFactorMixin, OIDCFactor):
    def __init__(
        self,
        *,
        connection_id: uuid.UUID,
        organization_slug: str,
        name: str | None,
        issuer: str,
        client_id: str,
        client_secret: str,
        authorization_parameters: dict[str, str],
        state_service: OAuth2StateService,
    ) -> None:
        super().__init__(
            identifier=str(connection_id),
            client_id=client_id,
            client_secret=client_secret,
            discovery_endpoint=_discovery_endpoint(issuer),
            state_service=state_service,
        )
        self.connection_id = connection_id
        self.organization_slug = organization_slug
        self.name = name
        self.authorization_parameters = authorization_parameters


class SSOPrivateKeyJWTFactor(SSOFactorMixin, PrivateKeyJWTOIDCFactor):
    def __init__(
        self,
        *,
        connection_id: uuid.UUID,
        organization_slug: str,
        name: str | None,
        issuer: str,
        client_id: str,
        authorization_parameters: dict[str, str],
        state_service: OAuth2StateService,
    ) -> None:
        super().__init__(
            identifier=str(connection_id),
            client_id=client_id,
            jwks=jwt.PyJWKSet.from_dict(settings.JWKS.as_dict(is_private=True)),
            kid=settings.CURRENT_JWK_KID,
            discovery_endpoint=_discovery_endpoint(issuer),
            state_service=state_service,
        )
        self.connection_id = connection_id
        self.organization_slug = organization_slug
        self.name = name
        self.authorization_parameters = authorization_parameters


def build_sso_factor(
    connection: OrganizationSSOConnection,
    *,
    organization_slug: str,
    state_service: OAuth2StateService,
) -> OIDCFactorBase:
    configuration = connection.configuration
    authorization_parameters = configuration.get("authorization_parameters") or {}
    if configuration["auth_method"] == OIDCAuthMethod.client_secret:
        client_secret = configuration.get("client_secret")
        assert client_secret is not None, (
            "client_secret auth_method requires a client_secret"
        )
        return SSOClientSecretFactor(
            connection_id=connection.id,
            organization_slug=organization_slug,
            name=connection.name,
            issuer=configuration["issuer"],
            client_id=configuration["client_id"],
            client_secret=client_secret,
            authorization_parameters=authorization_parameters,
            state_service=state_service,
        )
    return SSOPrivateKeyJWTFactor(
        connection_id=connection.id,
        organization_slug=organization_slug,
        name=connection.name,
        issuer=configuration["issuer"],
        client_id=configuration["client_id"],
        authorization_parameters=authorization_parameters,
        state_service=state_service,
    )
