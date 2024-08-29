from collections.abc import Sequence
from typing import Literal, cast

from fastapi import Depends, Form, HTTPException, Request, Response

from polar.auth.dependencies import WebUser, WebUserOrAnonymous
from polar.auth.models import is_user
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import OAuth2Token, Organization
from polar.openapi import IN_DEVELOPMENT_ONLY, APITag
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from ..authorization_server import (
    AuthorizationServer,
    ClientConfigurationEndpoint,
    ClientRegistrationEndpoint,
    IntrospectionEndpoint,
    RevocationEndpoint,
)
from ..dependencies import get_authorization_server, get_token
from ..grants import AuthorizationCodeGrant
from ..schemas import (
    AuthorizeResponse,
    IntrospectTokenRequest,
    IntrospectTokenResponse,
    OAuth2Client,
    OAuth2ClientConfiguration,
    OAuth2ClientConfigurationUpdate,
    RevokeTokenRequest,
    RevokeTokenResponse,
    TokenRequestAdapter,
    TokenResponse,
    authorize_response_adapter,
)
from ..schemas import (
    UserInfo as UserInfoSchema,
)
from ..service.oauth2_client import oauth2_client as oauth2_client_service
from ..sub_type import SubType
from ..userinfo import UserInfo, generate_user_info

router = APIRouter(prefix="/oauth2", tags=["oauth2"])


@router.get(
    "/",
    summary="List Clients",
    tags=["clients", APITag.documented],
    response_model=ListResource[OAuth2Client],
)
async def list(
    auth_subject: WebUser,
    pagination: PaginationParamsQuery,
    session: AsyncSession = Depends(get_db_session),
) -> ListResource[OAuth2Client]:
    """List OAuth2 clients."""
    results, count = await oauth2_client_service.list(
        session, auth_subject, pagination=pagination
    )
    return ListResource.from_paginated_results(
        [OAuth2Client.model_validate(result) for result in results], count, pagination
    )


@router.post(
    "/register",
    summary="Create Client",
    tags=["clients", APITag.documented],
    name="oauth2:create_client",
)
async def create(
    client_configuration: OAuth2ClientConfiguration,
    request: Request,
    auth_subject: WebUser,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    """Create an OAuth2 client."""
    request.state.user = auth_subject.subject
    request.state.parsed_data = client_configuration.model_dump(mode="json")
    return authorization_server.create_endpoint_response(
        ClientRegistrationEndpoint.ENDPOINT_NAME, request
    )


@router.get(
    "/register/{client_id}",
    tags=["clients", APITag.documented],
    summary="Get Client",
    name="oauth2:get_client",
)
async def get(
    client_id: str,
    request: Request,
    auth_subject: WebUserOrAnonymous,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    """Get an OAuth2 client by Client ID."""
    request.state.user = auth_subject.subject if is_user(auth_subject) else None
    return authorization_server.create_endpoint_response(
        ClientConfigurationEndpoint.ENDPOINT_NAME, request
    )


@router.put(
    "/register/{client_id}",
    tags=["clients", APITag.documented],
    summary="Update Client",
    name="oauth2:update_client",
)
async def update(
    client_id: str,
    client_configuration: OAuth2ClientConfigurationUpdate,
    request: Request,
    auth_subject: WebUserOrAnonymous,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    """Update an OAuth2 client."""
    request.state.user = auth_subject.subject if is_user(auth_subject) else None
    request.state.parsed_data = client_configuration.model_dump(mode="json")
    return authorization_server.create_endpoint_response(
        ClientConfigurationEndpoint.ENDPOINT_NAME, request
    )


@router.delete(
    "/register/{client_id}",
    tags=["clients", APITag.documented],
    summary="Delete Client",
    name="oauth2:delete_client",
)
async def delete(
    client_id: str,
    request: Request,
    auth_subject: WebUserOrAnonymous,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    """Delete an OAuth2 client."""
    request.state.user = auth_subject.subject if is_user(auth_subject) else None
    return authorization_server.create_endpoint_response(
        ClientConfigurationEndpoint.ENDPOINT_NAME, request
    )


@router.get("/authorize")
async def authorize(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
    session: AsyncSession = Depends(get_db_session),
) -> AuthorizeResponse:
    user = auth_subject.subject if is_user(auth_subject) else None
    await request.form()
    grant: AuthorizationCodeGrant = authorization_server.get_consent_grant(
        request=request, end_user=user
    )

    if grant.prompt == "login":
        raise HTTPException(status_code=401)
    elif grant.prompt == "none":
        return authorization_server.create_authorization_response(
            request=request, grant_user=user, save_consent=False
        )

    organizations: Sequence[Organization] | None = None
    if grant.sub_type == SubType.organization:
        assert is_user(auth_subject)
        organizations = await organization_service.list_all_orgs_by_user_id(
            session, auth_subject.subject.id
        )

    return authorize_response_adapter.validate_python(
        {
            "client": grant.client,
            "scopes": grant.request.scope,
            "sub_type": grant.sub_type,
            "sub": grant.sub,
            "organizations": organizations,
        }
    )


@router.post("/consent", include_in_schema=IN_DEVELOPMENT_ONLY)
async def consent(
    request: Request,
    auth_subject: WebUser,
    action: Literal["allow", "deny"] = Form(...),
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    await request.form()
    grant_user = auth_subject.subject if action == "allow" else None
    return authorization_server.create_authorization_response(
        request=request, grant_user=grant_user, save_consent=True
    )


_request_token_schema = TokenRequestAdapter.json_schema(
    ref_template="#/paths/~1v1~1oauth2~1token/post/x-components/{model}"
)
_request_token_schema_defs = _request_token_schema.pop("$defs")


@router.post(
    "/token",
    summary="Request Token",
    name="oauth2:request_token",
    operation_id="oauth2:request_token",
    tags=[APITag.featured, APITag.documented],
    openapi_extra={
        "x-components": _request_token_schema_defs,
        "requestBody": {
            "required": True,
            "content": {
                "application/x-www-form-urlencoded": {"schema": _request_token_schema}
            },
        },
    },
    response_model=TokenResponse,
)
async def token(
    request: Request,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    """Request an access token using a valid grant."""
    await request.form()
    return authorization_server.create_token_response(request)


@router.post(
    "/revoke",
    summary="Revoke Token",
    name="oauth2:revoke_token",
    operation_id="oauth2:revoke_token",
    tags=[APITag.featured, APITag.documented],
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/x-www-form-urlencoded": {
                    "schema": RevokeTokenRequest.model_json_schema()
                }
            },
        },
    },
    response_model=RevokeTokenResponse,
)
async def revoke(
    request: Request,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    """Revoke an access token or a refresh token."""
    await request.form()
    return authorization_server.create_endpoint_response(
        RevocationEndpoint.ENDPOINT_NAME, request
    )


@router.post(
    "/introspect",
    summary="Introspect Token",
    name="oauth2:introspect_token",
    operation_id="oauth2:introspect_token",
    tags=[APITag.featured, APITag.documented],
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/x-www-form-urlencoded": {
                    "schema": IntrospectTokenRequest.model_json_schema()
                }
            },
        },
    },
    response_model=IntrospectTokenResponse,
)
async def introspect(
    request: Request,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    """Get information about an access token."""
    await request.form()
    return authorization_server.create_endpoint_response(
        IntrospectionEndpoint.ENDPOINT_NAME, request
    )


@router.get(
    "/userinfo",
    summary="Get User Info",
    name="oauth2:userinfo",
    operation_id="oauth2:userinfo",
    response_model=UserInfoSchema,
    tags=[APITag.featured, APITag.documented],
    openapi_extra={"x-speakeasy-name-override": "userinfo"},
)
async def userinfo_get(token: OAuth2Token = Depends(get_token)) -> UserInfo:
    """Get information about the authenticated user."""
    return generate_user_info(token.get_sub_type_value(), cast(str, token.scope))


# Repeat the /userinfo endpoint to support POST requests
# But don't include it in the OpenAPI schema
@router.post(
    "/userinfo",
    summary="Get User Info",
    response_model=UserInfoSchema,
    include_in_schema=False,
)
async def userinfo_post(token: OAuth2Token = Depends(get_token)) -> UserInfo:
    """Get information about the authenticated user."""
    return generate_user_info(token.get_sub_type_value(), cast(str, token.scope))
