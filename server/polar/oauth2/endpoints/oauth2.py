from collections.abc import Sequence
from typing import Literal, cast

from fastapi import Depends, Form, HTTPException, Request, Response

from polar.auth.dependencies import WebUser, WebUserOrAnonymous
from polar.auth.models import is_user
from polar.kit.pagination import ListResource, PaginationParamsQuery
from polar.kit.routing import APIRouter
from polar.models import OAuth2Token, Organization
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, get_db_session

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
    OAuth2Client,
    OAuth2ClientConfiguration,
    OAuth2ClientConfigurationUpdate,
    authorize_response_adapter,
)
from ..service.oauth2_client import oauth2_client as oauth2_client_service
from ..sub_type import SubType
from ..userinfo import UserInfo, generate_user_info

router = APIRouter(prefix="/oauth2", tags=["oauth2"])


@router.get("/", response_model=ListResource[OAuth2Client])
async def list_oauth2_clients(
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


@router.post("/register", name="oauth2.register")
async def oauth2_register(
    client_configuration: OAuth2ClientConfiguration,
    request: Request,
    auth_subject: WebUser,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    request.state.user = auth_subject.subject
    request.state.parsed_data = client_configuration.model_dump(mode="json")
    return authorization_server.create_endpoint_response(
        ClientRegistrationEndpoint.ENDPOINT_NAME, request
    )


@router.get("/register/{client_id}", name="oauth2.configure_get")
async def oauth2_configure_get(
    client_id: str,
    request: Request,
    auth_subject: WebUserOrAnonymous,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    request.state.user = auth_subject.subject if is_user(auth_subject) else None
    return authorization_server.create_endpoint_response(
        ClientConfigurationEndpoint.ENDPOINT_NAME, request
    )


@router.put("/register/{client_id}", name="oauth2.configure_put")
async def oauth2_configure_put(
    client_id: str,
    client_configuration: OAuth2ClientConfigurationUpdate,
    request: Request,
    auth_subject: WebUserOrAnonymous,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    request.state.user = auth_subject.subject if is_user(auth_subject) else None
    request.state.parsed_data = client_configuration.model_dump(mode="json")
    return authorization_server.create_endpoint_response(
        ClientConfigurationEndpoint.ENDPOINT_NAME, request
    )


@router.delete("/register/{client_id}", name="oauth2.configure_delete")
async def oauth2_configure_delete(
    client_id: str,
    request: Request,
    auth_subject: WebUserOrAnonymous,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    request.state.user = auth_subject.subject if is_user(auth_subject) else None
    return authorization_server.create_endpoint_response(
        ClientConfigurationEndpoint.ENDPOINT_NAME, request
    )


@router.get("/authorize", name="oauth2.authorize")
async def oauth2_authorize(
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
            session, auth_subject.subject.id, is_admin_only=True
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


@router.post("/consent", name="oauth2.consent")
async def oauth2_consent(
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


@router.post("/token", name="oauth2.token")
async def oauth2_token(
    request: Request,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    await request.form()
    return authorization_server.create_token_response(request)


@router.post("/revoke", name="oauth2.revoke")
async def oauth2_revoke(
    request: Request,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    await request.form()
    return authorization_server.create_endpoint_response(
        RevocationEndpoint.ENDPOINT_NAME, request
    )


@router.post("/introspect", name="oauth2.introspect")
async def oauth2_introspect(
    request: Request,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    await request.form()
    return authorization_server.create_endpoint_response(
        IntrospectionEndpoint.ENDPOINT_NAME, request
    )


@router.api_route(
    "/userinfo",
    methods=["GET", "POST"],
    name="oauth2.userinfo",
    response_model=None,
)
async def oauth2_userinfo(token: OAuth2Token = Depends(get_token)) -> UserInfo:
    return generate_user_info(token.get_sub_type_value(), cast(str, token.scope))
