from typing import Any

from authlib.oauth2 import OAuth2Error
from fastapi import Depends, HTTPException, Request, Response

from polar.auth.dependencies import UserRequiredAuth
from polar.kit.routing import APIRouter

from .authorization_server import AuthorizationServer
from .dependencies import get_authorization_server
from .grants import BaseGrant

router = APIRouter(prefix="/oauth2", tags=["oauth2"])


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
        return {"grant": grant.request.scope, "user": user.id}

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
