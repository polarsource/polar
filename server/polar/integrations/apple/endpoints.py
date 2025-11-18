import uuid
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
from polar.exceptions import PolarRedirectionError
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


@router.get("/authorize", name="integrations.apple.authorize")
async def apple_authorize(
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

    encoded_state = jwt.encode(data=state, secret=settings.SECRET, type="apple_oauth")
    redirect_uri = str(request.url_for("integrations.apple.callback"))
    apple_oauth_client = get_apple_oauth_client()
    authorization_url = await apple_oauth_client.get_authorization_url(
        redirect_uri=redirect_uri,
        state=encoded_state,
        extras_params={"response_mode": "form_post"},
    )
    return RedirectResponse(authorization_url, 303)


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

    try:
        state_data = jwt.decode(token=state, secret=settings.SECRET, type="apple_oauth")
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
            is_signup = False
            user = await apple_service.link_user(
                session, user=auth_subject.subject, token=token_data
            )
        else:
            user, is_signup = await apple_service.get_updated_or_create(
                session,
                token=token_data,
                signup_attribution=state_signup_attribution,
            )
    except AppleServiceError as e:
        raise OAuthCallbackError(e.message, e.status_code, return_to=return_to) from e

    # Event tracking last to ensure business critical data is stored first
    if is_signup:
        posthog.user_signup(user, "apple")
        await loops_service.user_signup(user)
    else:
        posthog.user_login(user, "apple")
        await loops_service.user_update(session, user)

    return await auth_service.get_login_response(
        session, request, user, return_to=return_to
    )
