from collections.abc import Sequence
from typing import Literal, cast

from fastapi import Depends, Form, HTTPException, Request, Response
from fastapi.openapi.constants import REF_TEMPLATE

from polar.auth.dependencies import WebUserOrAnonymous, WebUserRead, WebUserWrite
from polar.auth.models import is_user
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.models import OAuth2Token, Organization
from polar.openapi import APITag
from polar.organization.repository import OrganizationRepository
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
    IntrospectTokenResponse,
    OAuth2Client,
    OAuth2ClientConfiguration,
    OAuth2ClientConfigurationUpdate,
    RevokeTokenResponse,
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
    tags=["clients", APITag.private],
    response_model=ListResource[OAuth2Client],
)
async def list(
    auth_subject: WebUserRead,
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
    tags=["clients", APITag.public],
    name="oauth2:create_client",
)
async def create(
    client_configuration: OAuth2ClientConfiguration,
    request: Request,
    auth_subject: WebUserOrAnonymous,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    """Create an OAuth2 client."""
    request.state.user = auth_subject.subject if is_user(auth_subject) else None
    request.state.parsed_data = client_configuration.model_dump(
        mode="json", exclude_none=True
    )
    return authorization_server.create_endpoint_response(
        ClientRegistrationEndpoint.ENDPOINT_NAME, request
    )


@router.get(
    "/register/{client_id}",
    tags=["clients", APITag.public],
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
    tags=["clients", APITag.public],
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
    request.state.parsed_data = client_configuration.model_dump(
        mode="json", exclude_none=True
    )
    return authorization_server.create_endpoint_response(
        ClientConfigurationEndpoint.ENDPOINT_NAME, request
    )


@router.delete(
    "/register/{client_id}",
    tags=["clients", APITag.public],
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


@router.get("/authorize", tags=[APITag.public])
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
        organization_repository = OrganizationRepository.from_session(session)
        organizations = await organization_repository.get_all_by_user(
            auth_subject.subject.id
        )

    payload = grant.request.payload
    assert payload is not None

    return authorize_response_adapter.validate_python(
        {
            "client": grant.client,
            "scopes": payload.scope,
            "sub_type": grant.sub_type,
            "sub": grant.sub,
            "organizations": organizations,
        }
    )


@router.post("/consent", tags=[APITag.private])
async def consent(
    request: Request,
    auth_subject: WebUserWrite,
    action: Literal["allow", "deny"] = Form(...),
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    await request.form()
    grant_user = auth_subject.subject if action == "allow" else None
    return authorization_server.create_authorization_response(
        request=request, grant_user=grant_user, save_consent=True
    )


@router.post(
    "/token",
    summary="Request Token",
    name="oauth2:request_token",
    operation_id="oauth2:request_token",
    tags=[APITag.public],
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/x-www-form-urlencoded": {
                    "schema": {
                        "oneOf": [
                            {
                                "$ref": REF_TEMPLATE.format(
                                    model="AuthorizationCodeTokenRequest"
                                )
                            },
                            {"$ref": REF_TEMPLATE.format(model="RefreshTokenRequest")},
                            {"$ref": REF_TEMPLATE.format(model="WebTokenRequest")},
                        ]
                    }
                }
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
    tags=[APITag.public],
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/x-www-form-urlencoded": {
                    "schema": {"$ref": REF_TEMPLATE.format(model="RevokeTokenRequest")}
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
    tags=[APITag.public],
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "application/x-www-form-urlencoded": {
                    "schema": {
                        "$ref": REF_TEMPLATE.format(model="IntrospectTokenRequest")
                    }
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
    response_model_exclude_unset=True,
    tags=[APITag.public],
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
    response_model_exclude_unset=True,
    include_in_schema=False,
)
async def userinfo_post(token: OAuth2Token = Depends(get_token)) -> UserInfo:
    """Get information about the authenticated user."""
    return generate_user_info(token.get_sub_type_value(), cast(str, token.scope))
