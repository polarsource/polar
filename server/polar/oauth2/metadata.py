from collections.abc import Callable
from typing import TYPE_CHECKING

from pydantic import BaseModel

from polar.config import settings

from . import constants

if TYPE_CHECKING:
    from .authorization_server import AuthorizationServer


class OAuth2AuthorizationServerMetadata(BaseModel):
    """
    OAuth 2.0 Authorization Server Metadata

    Conforms to RFC8414.
    https://datatracker.ietf.org/doc/html/rfc8414
    """

    issuer: str
    authorization_endpoint: str
    token_endpoint: str
    jwks_uri: str
    registration_endpoint: str | None = None
    scopes_supported: list[str]
    response_types_supported: list[str]
    response_modes_supported: list[str] | None = None
    grant_types_supported: list[str] | None = None
    token_endpoint_auth_methods_supported: list[str] | None = None
    token_endpoint_auth_signing_alg_values_supported: list[str] | None = None
    service_documentation: str | None = None
    ui_locales_supported: list[str] | None = None
    op_policy_uri: str | None = None
    op_tos_uri: str | None = None
    revocation_endpoint: str | None = None
    revocation_endpoint_auth_methods_supported: list[str] | None = None
    revocation_endpoint_auth_signing_alg_values_supported: list[str] | None = None
    introspection_endpoint: str | None = None
    introspection_endpoint_auth_methods_supported: list[str] | None = None
    introspection_endpoint_auth_signing_alg_values_supported: list[str] | None = None
    code_challenge_methods_supported: list[str] | None = None


class OpenIDProviderMetadata(OAuth2AuthorizationServerMetadata):
    """
    OpenID Provider Metadata

    Conforms to OpenID Connect Discovery 1.0 specification.
    https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
    """

    userinfo_endpoint: str
    acr_values_supported: list[str] | None = None
    subject_types_supported: list[str]
    id_token_signing_alg_values_supported: list[str]
    id_token_encryption_alg_values_supported: list[str] | None = None
    id_token_encryption_enc_values_supported: list[str] | None = None
    userinfo_signing_alg_values_supported: list[str] | None = None
    userinfo_encryption_alg_values_supported: list[str] | None = None
    userinfo_encryption_enc_values_supported: list[str] | None = None
    request_object_signing_alg_values_supported: list[str] | None = None
    request_object_encryption_alg_values_supported: list[str] | None = None
    request_object_encryption_enc_values_supported: list[str] | None = None
    display_values_supported: list[str] | None = None
    claim_types_supported: list[str] | None = None
    claims_supported: list[str] | None = None
    claims_locales_supported: list[str] | None = None
    claims_parameter_supported: bool | None = None
    request_parameter_supported: bool | None = None
    request_uri_parameter_supported: bool | None = None
    require_request_uri_registration: bool | None = None


def get_server_metadata(
    authorization_server: "AuthorizationServer", url_for: Callable[[str], str]
) -> OpenIDProviderMetadata:
    return OpenIDProviderMetadata(
        issuer=constants.ISSUER,
        authorization_endpoint=f"{settings.FRONTEND_BASE_URL}/oauth2/authorize",
        token_endpoint=url_for("oauth2.token"),
        jwks_uri=url_for("well_known.jwks"),
        userinfo_endpoint=url_for("oauth2.userinfo"),
        registration_endpoint=url_for("oauth2.register"),
        scopes_supported=constants.SCOPES_SUPPORTED,
        response_types_supported=authorization_server.response_types_supported,
        response_modes_supported=authorization_server.response_modes_supported,
        grant_types_supported=authorization_server.grant_types_supported,
        token_endpoint_auth_methods_supported=authorization_server.token_endpoint_auth_methods_supported,
        service_documentation=constants.SERVICE_DOCUMENTATION,
        revocation_endpoint=url_for("oauth2.revoke"),
        revocation_endpoint_auth_methods_supported=authorization_server.revocation_endpoint_auth_methods_supported,
        introspection_endpoint=url_for("oauth2.introspect"),
        introspection_endpoint_auth_methods_supported=authorization_server.introspection_endpoint_auth_methods_supported,
        code_challenge_methods_supported=authorization_server.code_challenge_methods_supported,
        subject_types_supported=constants.SUBJECT_TYPES_SUPPORTED,
        id_token_signing_alg_values_supported=constants.ID_TOKEN_SIGNING_ALG_VALUES_SUPPORTED,
        claims_supported=constants.CLAIMS_SUPPORTED,
    )
