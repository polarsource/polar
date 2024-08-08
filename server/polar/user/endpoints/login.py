from uuid import UUID

import structlog
from fastapi import (
    Depends,
    Request,
)
from fastapi.responses import RedirectResponse
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token
from pydantic import ValidationError

from polar.auth.dependencies import WebUserOrAnonymous
from polar.auth.models import is_user
from polar.auth.service import AuthService
from polar.config import settings
from polar.enums import UserSignupType
from polar.exceptions import (
    PolarRedirectionError,
)
from polar.integrations.github.schemas import (
    OAuthAccessToken,
)
from polar.integrations.github.service.user import GithubUserServiceError, github_user
from polar.kit import jwt
from polar.kit.http import ReturnTo
from polar.locker import Locker, get_locker
from polar.models.benefit import BenefitType
from polar.openapi import IN_DEVELOPMENT_ONLY
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.reward.service import reward_service
from polar.routing import APIRouter
from polar.worker import enqueue_job

log = structlog.get_logger()


router = APIRouter(prefix="/login", include_in_schema=IN_DEVELOPMENT_ONLY)


###############################################################################
# GITHUB
###############################################################################

github_oauth_client = GitHubOAuth2(
    settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET
)
oauth2_authorize_callback = OAuth2AuthorizeCallback(
    github_oauth_client, route_name="integrations.github.callback"
)


class OAuthCallbackError(PolarRedirectionError): ...


@router.get("/github/authorize", name="integrations.github.authorize")
async def github_authorize(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    return_to: ReturnTo,
    payment_intent_id: str | None = None,
    user_signup_type: UserSignupType | None = None,
) -> RedirectResponse:
    state = {}
    if payment_intent_id:
        state["payment_intent_id"] = payment_intent_id

    state["return_to"] = return_to

    if user_signup_type:
        state["user_signup_type"] = user_signup_type

    if is_user(auth_subject):
        state["user_id"] = str(auth_subject.subject.id)

    encoded_state = jwt.encode(data=state, secret=settings.SECRET, type="github_oauth")
    authorization_url = await github_oauth_client.get_authorization_url(
        redirect_uri=str(request.url_for("integrations.github.callback")),
        state=encoded_state,
        scope=["user", "user:email"],
    )
    return RedirectResponse(authorization_url, 303)


@router.get("/github/callback", name="integrations.github.callback")
async def github_callback(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    session: AsyncSession = Depends(get_db_session),
    access_token_state: tuple[OAuth2Token, str | None] = Depends(
        oauth2_authorize_callback
    ),
    locker: Locker = Depends(get_locker),
) -> RedirectResponse:
    token_data, state = access_token_state
    error_description = token_data.get("error_description")
    if error_description:
        raise OAuthCallbackError(error_description)
    if not state:
        raise OAuthCallbackError("No state")

    try:
        state_data = jwt.decode(
            token=state, secret=settings.SECRET, type="github_oauth"
        )
    except jwt.DecodeError as e:
        raise OAuthCallbackError("Invalid state") from e

    return_to = state_data.get("return_to", None)

    try:
        tokens = OAuthAccessToken(**token_data)
    except ValidationError as e:
        raise OAuthCallbackError("Invalid token data", return_to=return_to) from e

    state_user_id = state_data.get("user_id")
    state_user_type = UserSignupType.backer
    if state_data.get("user_signup_type") == UserSignupType.maintainer:
        state_user_type = UserSignupType.maintainer

    try:
        if (
            is_user(auth_subject)
            and state_user_id is not None
            and auth_subject.subject.id == UUID(state_user_id)
        ):
            user = await github_user.link_existing_user(
                session, user=auth_subject.subject, tokens=tokens
            )
        else:
            user = await github_user.login_or_signup(
                session, locker, tokens=tokens, signup_type=state_user_type
            )

    except GithubUserServiceError as e:
        raise OAuthCallbackError(e.message, e.status_code, return_to=return_to) from e

    payment_intent_id = state_data.get("payment_intent_id")
    if payment_intent_id:
        await pledge_service.connect_backer(
            session, payment_intent_id=payment_intent_id, backer=user
        )

    # connect dangling rewards
    await reward_service.connect_by_username(session, user)

    # Make sure potential GitHub benefits are granted
    enqueue_job(
        "benefit.precondition_fulfilled",
        user_id=user.id,
        benefit_type=BenefitType.github_repository,
    )

    posthog.identify(user)
    posthog.auth_subject_event(auth_subject, "user", "github_oauth_login", "done")

    return AuthService.generate_login_cookie_response(
        request=request, user=user, return_to=return_to
    )
