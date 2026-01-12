import uuid
from typing import Any

from fastapi import Depends, Request
from fastapi.responses import RedirectResponse
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token

from polar.auth.dependencies import WebUserOrAnonymous, WebUserWrite
from polar.auth.models import is_user
from polar.auth.service import auth as auth_service
from polar.exceptions import NotPermitted
from polar.integrations.loops.service import loops as loops_service
from polar.kit.http import ReturnTo, get_safe_return_url
from polar.kit.oauth import (
    OAuthCallbackError,
    clear_login_cookie,
    encode_state,
    set_login_cookie,
    validate_callback,
)
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.routing import APIRouter
from polar.user.schemas import UserSignupAttribution, UserSignupAttributionQuery

from .service import GoogleServiceError, google_oauth_client
from .service import google as google_service

oauth2_login_authorize_callback = OAuth2AuthorizeCallback(
    google_oauth_client, route_name="integrations.google.login.callback"
)
oauth2_link_authorize_callback = OAuth2AuthorizeCallback(
    google_oauth_client, route_name="integrations.google.link.callback"
)


GOOGLE_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/userinfo.email",
]


async def create_authorization_response(
    request: Request,
    state: dict[str, Any],
    callback_route: str,
) -> RedirectResponse:
    encoded_state = encode_state(state, type="google_oauth")
    redirect_uri = str(request.url_for(callback_route))
    authorization_url = await google_oauth_client.get_authorization_url(
        redirect_uri=redirect_uri,
        state=encoded_state,
        scope=GOOGLE_OAUTH_SCOPES,
    )
    response = RedirectResponse(authorization_url, 303)
    set_login_cookie(request, response, encoded_state)
    return response


login_router = APIRouter(
    prefix="/login",
    tags=["integrations_google_login", APITag.private],
)


@login_router.get("/authorize", name="integrations.google.login.authorize")
async def login_authorize(
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

    return await create_authorization_response(
        request, state, "integrations.google.login.callback"
    )


@login_router.get("/callback", name="integrations.google.login.callback")
async def login_callback(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
    access_token_state: tuple[OAuth2Token, str | None] = Depends(
        oauth2_login_authorize_callback
    ),
) -> RedirectResponse:
    if is_user(auth_subject):
        raise NotPermitted()

    token_data, state = access_token_state
    state_data = validate_callback(request, token_data, state, type="google_oauth")

    return_to = state_data.get("return_to", None)

    state_signup_attribution = state_data.get("signup_attribution")
    if state_signup_attribution:
        state_signup_attribution = UserSignupAttribution.model_validate(
            state_signup_attribution
        )

    try:
        user, is_signup = await google_service.get_updated_or_create(
            session,
            token=token_data,
            signup_attribution=state_signup_attribution,
        )
    except GoogleServiceError as e:
        raise OAuthCallbackError(e.message, e.status_code, return_to=return_to) from e

    if is_signup:
        posthog.user_signup(user, "google")
        await loops_service.user_signup(user, googleLogin=True)
    else:
        posthog.user_login(user, "google")
        await loops_service.user_update(session, user, googleLogin=True)

    response = await auth_service.get_login_response(
        session, request, user, return_to=return_to
    )
    clear_login_cookie(request, response)
    return response


link_router = APIRouter(
    prefix="/link",
    tags=["integrations_google_link", APITag.private],
)


@link_router.get("/authorize", name="integrations.google.link.authorize")
async def link_authorize(
    request: Request, auth_subject: WebUserWrite, return_to: ReturnTo
) -> RedirectResponse:
    state: dict[str, Any] = {
        "return_to": return_to,
        "user_id": str(auth_subject.subject.id),
    }

    return await create_authorization_response(
        request, state, "integrations.google.link.callback"
    )


@link_router.get("/callback", name="integrations.google.link.callback")
async def link_callback(
    request: Request,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
    access_token_state: tuple[OAuth2Token, str | None] = Depends(
        oauth2_link_authorize_callback
    ),
) -> RedirectResponse:
    token_data, state = access_token_state
    state_data = validate_callback(request, token_data, state, type="google_oauth")

    return_to = state_data.get("return_to", None)
    state_user_id = state_data.get("user_id")

    if state_user_id is None or auth_subject.subject.id != uuid.UUID(state_user_id):
        raise OAuthCallbackError("Invalid user for linking", return_to=return_to)

    try:
        await google_service.link_user(
            session, user=auth_subject.subject, token=token_data
        )
    except GoogleServiceError as e:
        raise OAuthCallbackError(e.message, e.status_code, return_to=return_to) from e

    return_url = get_safe_return_url(return_to)
    response = RedirectResponse(return_url, 303)
    clear_login_cookie(request, response)
    return response


router = APIRouter(
    prefix="/integrations/google",
    tags=["integrations_google", APITag.private],
)
router.include_router(login_router)
router.include_router(link_router)
