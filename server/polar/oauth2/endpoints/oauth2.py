from typing import Any, cast

from authlib.oauth2 import OAuth2Error
from fastapi import Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse

from polar.auth.dependencies import Auth, UserRequiredAuth
from polar.kit.routing import APIRouter
from polar.models import OAuth2Token

from ..authorization_server import (
    AuthorizationServer,
    ClientRegistrationEndpoint,
    IntrospectionEndpoint,
    RevocationEndpoint,
)
from ..dependencies import get_authorization_server, get_token
from ..grants import BaseGrant
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


@router.api_route("/authorize", methods=["GET", "POST"], name="oauth2.authorize")
async def oauth2_authorize(
    request: Request,
    auth: UserRequiredAuth,
    authorization_server: AuthorizationServer = Depends(get_authorization_server),
) -> Any:
    user = auth.user
    form = await request.form()
    if request.method == "GET":
        try:
            grant: BaseGrant = authorization_server.get_consent_grant(
                request=request, end_user=user
            )
        except OAuth2Error as error:
            raise HTTPException(status_code=400, detail=dict(error.get_body()))
        return HTMLResponse(
            """
            <form method="POST">
                <input type="hidden" name="confirm" value="true">
                <button type="submit">Confirm</button>
            </form>
            """
        )

    if form.get("confirm"):
        grant_user = user
    else:
        grant_user = None
    return authorization_server.create_authorization_response(
        request=request, grant_user=grant_user
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
    "/userinfo", methods=["GET", "POST"], name="oauth2.userinfo", response_model=None
)
async def oauth2_userinfo(token: OAuth2Token = Depends(get_token)) -> UserInfo:
    return generate_user_info(token.user, cast(str, token.scope))
