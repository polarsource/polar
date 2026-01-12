from typing import Any
from uuid import UUID

from fastapi import Depends, Header, Request
from fastapi.responses import JSONResponse, RedirectResponse
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token

from polar.auth.dependencies import WebUserOrAnonymous, WebUserWrite
from polar.auth.models import is_user
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.exceptions import NotPermitted, PolarRedirectionError
from polar.integrations.loops.service import loops as loops_service
from polar.kit import jwt
from polar.kit.http import ReturnTo, get_safe_return_url
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.posthog import posthog
from polar.routing import APIRouter
from polar.user.schemas import UserSignupAttribution, UserSignupAttributionQuery

from .service.secret_scanning import secret_scanning as secret_scanning_service
from .service.user import GithubUserServiceError, github_user

github_oauth_client = GitHubOAuth2(
    settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET
)
oauth2_login_authorize_callback = OAuth2AuthorizeCallback(
    github_oauth_client, route_name="integrations.github.login.callback"
)
oauth2_link_authorize_callback = OAuth2AuthorizeCallback(
    github_oauth_client, route_name="integrations.github.link.callback"
)


GITHUB_OAUTH_SCOPES = ["user", "user:email"]


class OAuthCallbackError(PolarRedirectionError): ...


class NotPermittedOrganizationBillingPlan(NotPermitted):
    def __init__(self) -> None:
        message = "Organization billing plan not accessible."
        super().__init__(message)


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
    )


def validate_oauth_callback(
    request: Request, token_data: OAuth2Token, state: str | None
) -> dict[str, Any]:
    error_description = token_data.get("error_description")
    if error_description:
        raise OAuthCallbackError(error_description)

    if not state:
        raise OAuthCallbackError("No state")

    session_cookie = request.cookies.get(settings.SOCIAL_LOGIN_SESSION_COOKIE_KEY)
    if session_cookie is None or session_cookie != state:
        raise OAuthCallbackError("Invalid session cookie")

    try:
        return jwt.decode(token=state, secret=settings.SECRET, type="github_oauth")
    except jwt.DecodeError as e:
        raise OAuthCallbackError("Invalid state") from e


async def create_authorization_response(
    request: Request,
    state: dict[str, Any],
    callback_route: str,
) -> RedirectResponse:
    encoded_state = jwt.encode(data=state, secret=settings.SECRET, type="github_oauth")
    redirect_uri = str(request.url_for(callback_route))
    authorization_url = await github_oauth_client.get_authorization_url(
        redirect_uri=redirect_uri,
        state=encoded_state,
        scope=GITHUB_OAUTH_SCOPES,
    )
    response = RedirectResponse(authorization_url, 303)
    set_login_cookie(request, response, encoded_state)
    return response


login_router = APIRouter(
    prefix="/login",
    tags=["integrations_github_login", APITag.private],
)


@login_router.get("/authorize", name="integrations.github.login.authorize")
async def login_authorize(
    request: Request,
    auth_subject: WebUserOrAnonymous,
    return_to: ReturnTo,
    signup_attribution: UserSignupAttributionQuery,
    payment_intent_id: str | None = None,
) -> RedirectResponse:
    if is_user(auth_subject):
        raise NotPermitted()

    state: dict[str, Any] = {"return_to": return_to}
    if payment_intent_id:
        state["payment_intent_id"] = payment_intent_id
    if signup_attribution:
        state["signup_attribution"] = signup_attribution.model_dump(exclude_unset=True)

    return await create_authorization_response(
        request, state, "integrations.github.login.callback"
    )


@login_router.get("/callback", name="integrations.github.login.callback")
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
    state_data = validate_oauth_callback(request, token_data, state)

    return_to = state_data.get("return_to", None)

    state_signup_attribution = state_data.get("signup_attribution")
    if state_signup_attribution:
        state_signup_attribution = UserSignupAttribution.model_validate(
            state_signup_attribution
        )

    try:
        user, is_signup = await github_user.get_updated_or_create(
            session,
            token=token_data,
            signup_attribution=state_signup_attribution,
        )
    except GithubUserServiceError as e:
        raise OAuthCallbackError(e.message, e.status_code, return_to=return_to) from e

    if is_signup:
        posthog.user_signup(user, "github")
        await loops_service.user_signup(user, githubLogin=True)
    else:
        posthog.user_login(user, "github")
        await loops_service.user_update(session, user, githubLogin=True)

    response = await auth_service.get_login_response(
        session, request, user, return_to=return_to
    )
    clear_login_cookie(request, response)
    return response


link_router = APIRouter(
    prefix="/link",
    tags=["integrations_github_link", APITag.private],
)


@link_router.get("/authorize", name="integrations.github.link.authorize")
async def link_authorize(
    request: Request, auth_subject: WebUserWrite, return_to: ReturnTo
) -> RedirectResponse:
    state: dict[str, Any] = {
        "return_to": return_to,
        "user_id": str(auth_subject.subject.id),
    }

    return await create_authorization_response(
        request, state, "integrations.github.link.callback"
    )


@link_router.get("/callback", name="integrations.github.link.callback")
async def link_callback(
    request: Request,
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
    access_token_state: tuple[OAuth2Token, str | None] = Depends(
        oauth2_link_authorize_callback
    ),
) -> RedirectResponse:
    token_data, state = access_token_state
    state_data = validate_oauth_callback(request, token_data, state)

    return_to = state_data.get("return_to", None)
    state_user_id = state_data.get("user_id")

    if state_user_id is None or auth_subject.subject.id != UUID(state_user_id):
        raise OAuthCallbackError("Invalid user for linking", return_to=return_to)

    try:
        await github_user.link_user(
            session, user=auth_subject.subject, token=token_data
        )
    except GithubUserServiceError as e:
        raise OAuthCallbackError(e.message, e.status_code, return_to=return_to) from e

    return_url = get_safe_return_url(return_to)
    response = RedirectResponse(return_url, 303)
    clear_login_cookie(request, response)
    return response


router = APIRouter(
    prefix="/integrations/github", tags=["integrations_github", APITag.private]
)
router.include_router(login_router)
router.include_router(link_router)


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
