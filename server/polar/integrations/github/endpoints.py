from typing import Any
from uuid import UUID

from fastapi import Depends, Header, Request
from fastapi.responses import JSONResponse, RedirectResponse
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token

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

from .service.secret_scanning import secret_scanning as secret_scanning_service
from .service.user import GithubUserServiceError, github_user

router = APIRouter(
    prefix="/integrations/github", tags=["integrations_github", APITag.private]
)


github_oauth_client = GitHubOAuth2(
    settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET
)
oauth2_authorize_callback = OAuth2AuthorizeCallback(
    github_oauth_client, route_name="integrations.github.callback"
)


class OAuthCallbackError(PolarRedirectionError): ...


class NotPermittedOrganizationBillingPlan(NotPermitted):
    def __init__(self) -> None:
        message = "Organization billing plan not accessible."
        super().__init__(message)


@router.get("/authorize", name="integrations.github.authorize")
async def github_authorize(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    return_to: ReturnTo,
    signup_attribution: UserSignupAttributionQuery,
    payment_intent_id: str | None = None,
) -> RedirectResponse:
    state: dict[str, Any] = {}
    if payment_intent_id:
        state["payment_intent_id"] = payment_intent_id

    state["return_to"] = return_to

    if signup_attribution:
        state["signup_attribution"] = signup_attribution.model_dump(exclude_unset=True)

    if is_user(auth_subject):
        state["user_id"] = str(auth_subject.subject.id)

    encoded_state = jwt.encode(data=state, secret=settings.SECRET, type="github_oauth")
    authorization_url = await github_oauth_client.get_authorization_url(
        redirect_uri=str(request.url_for("integrations.github.callback")),
        state=encoded_state,
        scope=["user", "user:email"],
    )
    return RedirectResponse(authorization_url, 303)


@router.get("/callback", name="integrations.github.callback")
async def github_callback(
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
            token=state, secret=settings.SECRET, type="github_oauth"
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
            and auth_subject.subject.id == UUID(state_user_id)
        ):
            is_signup = False
            user = await github_user.link_user(
                session, user=auth_subject.subject, token=token_data
            )
        else:
            user, is_signup = await github_user.get_updated_or_create(
                session,
                token=token_data,
                signup_attribution=state_signup_attribution,
            )

    except GithubUserServiceError as e:
        raise OAuthCallbackError(e.message, e.status_code, return_to=return_to) from e

    # Event tracking last to ensure business critical data is stored first
    if is_signup:
        posthog.user_signup(user, "github")
        await loops_service.user_signup(user, githubLogin=True)
    else:
        posthog.user_login(user, "github")
        await loops_service.user_update(session, user, githubLogin=True)

    return await auth_service.get_login_response(
        session, request, user, return_to=return_to
    )


@router.post("/secret-scanning", include_in_schema=False)
async def secret_scanning(
    request: Request,
    github_public_key_identifier: str = Header(),
    github_public_key_signature: str = Header(),
    session: AsyncSession = Depends(get_db_session),
) -> JSONResponse:
    payload = (await request.body()).decode()
    await secret_scanning_service.verify_signature(
        payload, github_public_key_signature, github_public_key_identifier
    )

    data = secret_scanning_service.validate_payload(payload)

    response_data = await secret_scanning_service.handle_alert(session, data)
    return JSONResponse(content=response_data)
