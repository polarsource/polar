from typing import Any

from fastapi import Depends, Request

from polar.config import settings
from polar.kit.routing import APIRouter

from .. import constants
from ..authorization_server import AuthorizationServer
from ..dependencies import get_authorization_server
from ..schemas import OpenIDProviderMetadata

router = APIRouter(prefix="/.well-known", tags=["well_known"])


@router.get("/jwks.json", name="well_known.jwks")
async def well_known_jwks() -> dict[str, Any]:
    return settings.JWKS.as_dict(is_private=False)


@router.get("/openid-configuration", name="well_known.openid_configuration")
async def well_known_openid_configuration(
    request: Request,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> dict[str, Any]:
    metadata = OpenIDProviderMetadata(
        issuer=constants.ISSUER,
        authorization_endpoint=str(request.url_for("oauth2.authorize")),
        token_endpoint=str(request.url_for("oauth2.token")),
        jwks_uri=str(request.url_for("well_known.jwks")),
        userinfo_endpoint="TODO",
        scopes_supported=constants.SCOPES_SUPPORTED,
        response_types_supported=authorization_server.response_types_supported,
        response_modes_supported=authorization_server.response_modes_supported,
        grant_types_supported=authorization_server.grant_types_supported,
        token_endpoint_auth_methods_supported=authorization_server.token_endpoint_auth_methods_supported,
        service_documentation=constants.SERVICE_DOCUMENTATION,
        revocation_endpoint=str(request.url_for("oauth2.revoke")),
        revocation_endpoint_auth_methods_supported=authorization_server.revocation_endpoint_auth_methods_supported,
        introspection_endpoint=str(request.url_for("oauth2.introspect")),
        introspection_endpoint_auth_methods_supported=authorization_server.introspection_endpoint_auth_methods_supported,
        subject_types_supported=constants.SUBJECT_TYPES_SUPPORTED,
        id_token_signing_alg_values_supported=constants.ID_TOKEN_SIGNING_ALG_VALUES_SUPPORTED,
        claims_supported=constants.CLAIMS_SUPPORTED,
    )
    return metadata.model_dump(exclude_unset=True)
