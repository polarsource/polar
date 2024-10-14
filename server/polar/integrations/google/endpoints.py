import uuid
from typing import Any

from fastapi import Depends, Request
from fastapi.responses import RedirectResponse
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token

from polar.auth.dependencies import WebUserOrAnonymous
from polar.auth.models import is_user
from polar.auth.service import AuthService
from polar.config import settings
from polar.exceptions import PolarRedirectionError
from polar.kit import jwt
from polar.kit.http import ReturnTo
from polar.openapi import IN_DEVELOPMENT_ONLY
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.routing import APIRouter
from polar.user.schemas.user import UserSignupAttribution, UserSignupAttributionQuery

from .service import GoogleServiceError, google_oauth_client
from .service import google as google_service

oauth2_authorize_callback = OAuth2AuthorizeCallback(
    google_oauth_client, route_name="integrations.google.callback"
)


class OAuthCallbackError(PolarRedirectionError): ...


router = APIRouter(
    prefix="/integrations/google",
    tags=["integrations_google"],
    include_in_schema=IN_DEVELOPMENT_ONLY,
)


@router.get("/authorize", name="integrations.google.authorize")
async def google_authorize(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    return_to: ReturnTo,
    signup_attribution: UserSignupAttributionQuery,
) -> RedirectResponse:
    state: dict[str, Any] = {}

    state["return_to"] = return_to

    if signup_attribution:
        state["signup_attribution"] = signup_attribution.model_dump(exclude_unset=True)

    if is_user(auth_subject):
        state["user_id"] = str(auth_subject.subject.id)

    encoded_state = jwt.encode(data=state, secret=settings.SECRET, type="google_oauth")
    redirect_uri = str(request.url_for("integrations.google.callback"))
    authorization_url = await google_oauth_client.get_authorization_url(
        redirect_uri=redirect_uri,
        state=encoded_state,
        scope=[
            "https://www.googleapis.com/auth/userinfo.profile",
            "https://www.googleapis.com/auth/userinfo.email",
        ],
    )
    return RedirectResponse(authorization_url, 303)


@router.get("/callback", name="integrations.google.callback")
async def google_callback(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
    access_token_state: tuple[OAuth2Token, str | None] = Depends(
        oauth2_authorize_callback
    ),
) -> RedirectResponse:
    token_data, state = access_token_state
    error_description = token_data.get("error_description")
    if error_description:
        raise OAuthCallbackError(error_description)
    if not state:
        raise OAuthCallbackError("No state")

    try:
        state_data = jwt.decode(
            token=state, secret=settings.SECRET, type="google_oauth"
        )
    except jwt.DecodeError as e:
        raise OAuthCallbackError("Invalid state") from e

    return_to = state_data.get("return_to", None)
    state_user_id = state_data.get("user_id")

    state_signup_attribution = state_data.get("signup_attribution")
    if state_signup_attribution:
        state_signup_attribution = UserSignupAttribution.model_validate(
            state_signup_attribution
        )

    try:
        if (
            is_user(auth_subject)
            and state_user_id is not None
            and auth_subject.subject.id == uuid.UUID(state_user_id)
        ):
            user = await google_service.link_user(
                session, user=auth_subject.subject, token=token_data
            )
        else:
            user = await google_service.login_or_signup(
                session,
                token=token_data,
                signup_attribution=state_signup_attribution,
            )
    except GoogleServiceError as e:
        raise OAuthCallbackError(e.message, e.status_code, return_to=return_to) from e

    posthog.identify(user)

    return AuthService.generate_login_cookie_response(
        request=request, user=user, return_to=return_to
    )
