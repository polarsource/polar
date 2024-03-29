from typing import Literal, cast

from fastapi import Depends, Form, HTTPException, Request, Response

from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.kit.routing import APIRouter
from polar.models import OAuth2Token
from polar.tags.api import Tags

from ..authorization_server import (
    AuthorizationServer,
    ClientConfigurationEndpoint,
    ClientRegistrationEndpoint,
    IntrospectionEndpoint,
    RevocationEndpoint,
)
from ..dependencies import get_authorization_server, get_token
from ..grants import BaseGrant
from ..schemas import AuthorizeResponse
from ..userinfo import UserInfo, generate_user_info

router = APIRouter(prefix="/oauth2", tags=["oauth2"])


@router.post("/register", name="oauth2.register")
async def oauth2_register(
    request: Request,
    auth: Auth = Depends(Auth.backoffice_user),
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    await request.json()
    request.state.user = auth.user
    return authorization_server.create_endpoint_response(
        ClientRegistrationEndpoint.ENDPOINT_NAME, request
    )


@router.api_route(
    "/register/{client_id}", methods=["GET", "PUT", "DELETE"], name="oauth2.configure"
)
async def oauth2_configure(
    client_id: str,
    request: Request,
    auth: Auth = Depends(Auth.backoffice_user),
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    if request.method == "PUT":
        await request.json()
    request.state.user = auth.user
    return authorization_server.create_endpoint_response(
        ClientConfigurationEndpoint.ENDPOINT_NAME, request
    )


@router.get("/authorize", name="oauth2.authorize")
async def oauth2_authorize(
    request: Request,
    auth: Auth = Depends(Auth.optional_user),
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> AuthorizeResponse:
    user = auth.user
    await request.form()
    grant: BaseGrant = authorization_server.get_consent_grant(
        request=request, end_user=user
    )

    if grant.prompt == "login":
        raise HTTPException(status_code=401)
    elif grant.prompt == "none":
        return authorization_server.create_authorization_response(
            request=request, grant_user=user, save_consent=False
        )

    return AuthorizeResponse.model_validate(
        {"client": grant.client, "scopes": grant.request.scope}
    )


@router.post("/consent", name="oauth2.consent")
async def oauth2_consent(
    request: Request,
    auth: UserRequiredAuth,
    action: Literal["allow", "deny"] = Form(...),
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    await request.form()
    grant_user = auth.user if action == "allow" else None
    return authorization_server.create_authorization_response(
        request=request, grant_user=grant_user, save_consent=True
    )


@router.post("/token", name="oauth2.token", tags=[Tags.PUBLIC])
async def oauth2_token(
    request: Request,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    await request.form()
    return authorization_server.create_token_response(request)


@router.post("/revoke", name="oauth2.revoke", tags=[Tags.PUBLIC])
async def oauth2_revoke(
    request: Request,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Response:
    await request.form()
    return authorization_server.create_endpoint_response(
        RevocationEndpoint.ENDPOINT_NAME, request
    )


@router.post("/introspect", name="oauth2.introspect", tags=[Tags.PUBLIC])
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
    tags=[Tags.PUBLIC],
)
async def oauth2_userinfo(token: OAuth2Token = Depends(get_token)) -> UserInfo:
    return generate_user_info(token.user, cast(str, token.scope))
