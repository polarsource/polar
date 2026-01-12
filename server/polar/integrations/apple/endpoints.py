from typing import Any

from fastapi import Depends, Form, Request
from fastapi.responses import RedirectResponse
from httpx_oauth.integrations.fastapi import (
    OAuth2AuthorizeCallbackError,
)
from httpx_oauth.oauth2 import GetAccessTokenError

from polar.auth.dependencies import WebUserOrAnonymous
from polar.auth.models import is_user
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.exceptions import NotPermitted, PolarRedirectionError
from polar.integrations.loops.service import loops as loops_service
from polar.kit import jwt
from polar.kit.http import ReturnTo
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.routing import APIRouter
from polar.user.schemas import UserSignupAttribution, UserSignupAttributionQuery

from .service import AppleServiceError, get_apple_oauth_client
from .service import apple as apple_service


class OAuthCallbackError(PolarRedirectionError): ...


router = APIRouter(
    prefix="/integrations/apple",
    tags=["integrations_apple", APITag.private],
)


def set_login_cookie(
    request: Request, response: RedirectResponse, encoded_state: str
) -> None:
    is_localhost = request.url.hostname in {"127.0.0.1", "localhost"}
    secure = False if is_localhost else True
    response.set_cookie(
        settings.SOCIAL_LOGIN_SESSION_COOKIE_KEY,
        value=encoded_state,
        max_age=int(settings.SOCIAL_LOGIN_SESSION_TTL.total_seconds()),
        path="/",
        secure=secure,
        httponly=True,
        samesite="none",  # Required since Apple uses form post which is cross-site
    )


def clear_login_cookie(request: Request, response: RedirectResponse) -> None:
    is_localhost = request.url.hostname in {"127.0.0.1", "localhost"}
    secure = False if is_localhost else True
    response.set_cookie(
        settings.SOCIAL_LOGIN_SESSION_COOKIE_KEY,
        value="",
        max_age=0,
        path="/",
        secure=secure,
        httponly=True,
        samesite="none",  # Required since Apple uses form post which is cross-site
    )


@router.get("/authorize", name="integrations.apple.authorize")
async def apple_authorize(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    return_to: ReturnTo,
    signup_attribution: UserSignupAttributionQuery,
) -> RedirectResponse:
    if is_user(auth_subject):
        raise NotPermitted()

    state: dict[str, Any] = {"return_to": return_to}
    if signup_attribution:
        state["signup_attribution"] = signup_attribution.model_dump(exclude_unset=True)

    encoded_state = jwt.encode(data=state, secret=settings.SECRET, type="apple_oauth")
    redirect_uri = str(request.url_for("integrations.apple.callback"))
    apple_oauth_client = get_apple_oauth_client()
    authorization_url = await apple_oauth_client.get_authorization_url(
        redirect_uri=redirect_uri,
        state=encoded_state,
        extras_params={"response_mode": "form_post"},
    )
    response = RedirectResponse(authorization_url, 303)
    set_login_cookie(request, response, encoded_state)
    return response


@router.post("/callback", name="integrations.apple.callback")
async def apple_callback(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    code: str | None = Form(None),
    code_verifier: str | None = Form(None),
    state: str | None = Form(None),
    error: str | None = Form(None),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    if is_user(auth_subject):
        raise NotPermitted()

    if code is None or error is not None:
        raise OAuth2AuthorizeCallbackError(
            status_code=400,
            detail=error if error is not None else None,
        )

    redirect_uri = str(request.url_for("integrations.apple.callback"))
    try:
        apple_oauth_client = get_apple_oauth_client(secret=True)
        token_data = await apple_oauth_client.get_access_token(
            code, redirect_uri, code_verifier
        )
    except GetAccessTokenError as e:
        raise OAuth2AuthorizeCallbackError(
            status_code=500,
            detail=e.message,
            response=e.response,
        ) from e

    error_description = token_data.get("error_description")
    if error_description:
        raise OAuthCallbackError(error_description)

    if not state:
        raise OAuthCallbackError("No state")

    session_cookie = request.cookies.get(settings.SOCIAL_LOGIN_SESSION_COOKIE_KEY)
    if session_cookie is None or session_cookie != state:
        raise OAuthCallbackError("Invalid session cookie")

    try:
        state_data = jwt.decode(token=state, secret=settings.SECRET, type="apple_oauth")
    except jwt.DecodeError as e:
        raise OAuthCallbackError("Invalid state") from e

    return_to = state_data.get("return_to", None)

    state_signup_attribution = state_data.get("signup_attribution")
    if state_signup_attribution:
        state_signup_attribution = UserSignupAttribution.model_validate(
            state_signup_attribution
        )

    try:
        user, is_signup = await apple_service.get_updated_or_create(
            session,
            token=token_data,
            signup_attribution=state_signup_attribution,
        )
    except AppleServiceError as e:
        raise OAuthCallbackError(e.message, e.status_code, return_to=return_to) from e

    if is_signup:
        posthog.user_signup(user, "apple")
        await loops_service.user_signup(user)
    else:
        posthog.user_login(user, "apple")
        await loops_service.user_update(session, user)

    response = await auth_service.get_login_response(
        session, request, user, return_to=return_to
    )
    clear_login_cookie(request, response)
    return response
