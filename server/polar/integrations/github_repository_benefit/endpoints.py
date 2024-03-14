import structlog
from fastapi import (
    APIRouter,
    Depends,
    Request,
)
from fastapi.responses import JSONResponse, RedirectResponse
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token

from polar.auth.dependencies import UserRequiredAuth
from polar.config import settings
from polar.exceptions import (
    NotPermitted,
    PolarRedirectionError,
    ResourceAlreadyExists,
)
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .service import github_repository_benefit_user_service

log = structlog.get_logger()

router = APIRouter(
    prefix="/integrations/github_repository_benefit", tags=["integrations"]
)


###############################################################################
# User OAuth
###############################################################################

github_oauth_client = GitHubOAuth2(
    settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_ID,
    settings.GITHUB_REPOSITORY_BENEFITS_CLIENT_SECRET,
)

oauth2_authorize_callback = OAuth2AuthorizeCallback(
    github_oauth_client,
    route_name="integrations.github_repository_benefit.user_callback",
)


class OAuthCallbackError(PolarRedirectionError):
    ...


class NotPermittedOrganizationBillingPlan(NotPermitted):
    def __init__(self) -> None:
        message = "Organization billing plan not accessible."
        super().__init__(message)


# /user/authorize
# /user/callback
# /installation/callback
# /repositories


@router.get(
    "/user/authorize",
    name="integrations.github_repository_benefit.user_authorize",
    tags=[Tags.INTERNAL],
)
async def user_authorize(
    request: Request,
    auth: UserRequiredAuth,
) -> RedirectResponse:
    authorization_url = await github_oauth_client.get_authorization_url(
        redirect_uri=str(
            request.url_for("integrations.github_repository_benefit.user_callback")
        ),
        scope=["user", "user.email"],
    )
    return RedirectResponse(authorization_url, 303)


@router.get(
    "/user/callback",
    name="integrations.github_repository_benefit.user_callback",
    tags=[Tags.INTERNAL],
)
async def user_callback(
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
    access_token_state: tuple[OAuth2Token, str | None] = Depends(
        oauth2_authorize_callback
    ),
) -> JSONResponse:
    token_data, state = access_token_state

    try:
        await github_repository_benefit_user_service.create_oauth_account(
            session,
            auth.user,
            token_data,
        )
    except ResourceAlreadyExists:
        existing = await github_repository_benefit_user_service.get_oauth_account(
            auth.user
        )
        await github_repository_benefit_user_service.update_user_info(session, existing)

    return JSONResponse({"ok": True})


###############################################################################
# Installation
###############################################################################
