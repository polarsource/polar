import secrets
import time

from authlib.integrations.httpx_client import AsyncOAuth2Client
from authlib.oauth2 import OAuth2Error
from fastapi import Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from httpx import HTTPError
from reauth.factors.oauth2.state import ExpiredStateException, InvalidStateException

from polar.auth.helpers import set_state_cookie
from polar.auth.oauth2.state import OAuth2StateService, get_oauth2_state_service
from polar.config import settings
from polar.oauth2.service.oauth2_token import oauth2_token as oauth2_token_service
from polar.postgres import AsyncSession, get_db_session

from .access import (
    SESSION_COOKIE,
    get_private_session,
    require_tailscale_user,
    validate_private_token,
)
from .routing import BackofficeRouter

router = BackofficeRouter(prefix="/auth")
STATE_PROVIDER = "private_backoffice"


def get_oauth_client() -> AsyncOAuth2Client:
    return AsyncOAuth2Client(
        client_id=settings.BACKOFFICE_OAUTH_CLIENT_ID,
        token_endpoint_auth_method="none",
        redirect_uri=f"{settings.BACKOFFICE_PRIVATE_URL}/auth/callback",
        scope="openid email",
        code_challenge_method="S256",
        timeout=15,
    )


@router.get("/login")
async def login(
    request: Request,
    state_service: OAuth2StateService = Depends(get_oauth2_state_service),
) -> RedirectResponse:
    verifier = secrets.token_urlsafe(32)
    state, oauth_state = await state_service.create(
        provider=STATE_PROVIDER,
        redirect_uri=f"{settings.BACKOFFICE_PRIVATE_URL}/auth/callback",
        code_verifier=verifier,
        scope=["openid", "email"],
    )
    async with get_oauth_client() as client:
        url, _ = client.create_authorization_url(
            settings.generate_frontend_url("/oauth2/authorize"),
            code_verifier=verifier,
            state=state,
            sub_type="user",
        )
    response = RedirectResponse(url, 303)
    set_state_cookie(request, response, state, oauth_state.expires_at)
    return response


@router.get("/callback")
async def callback(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    state_service: OAuth2StateService = Depends(get_oauth2_state_service),
) -> RedirectResponse:
    state = request.query_params.get("state", "")
    cookie = request.cookies.get(settings.OAUTH2_SESSION_STATE_COOKIE_KEY, "")
    if (
        not state
        or not state.isascii()
        or not cookie.isascii()
        or not secrets.compare_digest(state, cookie)
    ):
        raise HTTPException(403, "Invalid login state")
    try:
        oauth_state = await state_service.consume(state)
    except (ExpiredStateException, InvalidStateException) as e:
        raise HTTPException(403, "Invalid or expired login state") from e
    if (
        oauth_state.provider != STATE_PROVIDER
        or oauth_state.redirect_uri
        != f"{settings.BACKOFFICE_PRIVATE_URL}/auth/callback"
    ):
        raise HTTPException(403, "Invalid login state")
    if request.query_params.get("error"):
        raise HTTPException(403, "Backoffice authorization was not granted")
    if not request.query_params.get("code"):
        raise HTTPException(400, "Missing authorization code")

    try:
        async with get_oauth_client() as client:
            token_data = await client.fetch_token(
                settings.generate_external_url("/v1/oauth2/token"),
                grant_type="authorization_code",
                code=request.query_params["code"],
                code_verifier=oauth_state.code_verifier,
            )
    except (OAuth2Error, HTTPError) as e:
        raise HTTPException(400, "Could not complete backoffice authorization") from e

    access_token = token_data["access_token"]
    token = await oauth2_token_service.get_by_access_token(session, access_token)
    if token is None:
        raise HTTPException(403, "Invalid backoffice authorization")
    admin = validate_private_token(token)
    require_tailscale_user(request, admin)
    response = RedirectResponse("/", 303)
    response.set_cookie(
        SESSION_COOKIE,
        access_token,
        max_age=max(0, token.expires_at - int(time.time())),
        secure=True,
        httponly=True,
        samesite="lax",
    )
    set_state_cookie(request, response, "", 0)
    return response


@router.post("/logout")
async def logout(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    admin = await get_private_session(request, session)
    if admin is not None:
        require_tailscale_user(request, admin)
        await session.delete(admin.oauth_token)
    response = RedirectResponse("/auth/login", 303)
    response.delete_cookie(SESSION_COOKIE, secure=True, httponly=True, samesite="lax")
    return response
