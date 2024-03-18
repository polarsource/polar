from typing import Any

import structlog
from fastapi import (
    APIRouter,
    Depends,
    Request,
    Response,
)
from fastapi.responses import RedirectResponse
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token

from polar.auth.dependencies import UserRequiredAuth
from polar.config import settings
from polar.eventstream.service import publish
from polar.exceptions import (
    NotPermitted,
    PolarRedirectionError,
    ResourceAlreadyExists,
    Unauthorized,
)
from polar.integrations.github_repository_benefit.schemas import (
    GitHubInvitesBenefitRepositories,
)
from polar.kit import jwt
from polar.kit.http import ReturnTo, add_query_parameters, get_safe_return_url
from polar.postgres import AsyncSession, get_db_session
from polar.tags.api import Tags

from .service import github_repository_benefit_user_service

log = structlog.get_logger()

router = APIRouter(
    prefix="/integrations/github_repository_benefit", tags=["integrations"]
)


###############################################################################
# OAUTH2
###############################################################################


def get_decoded_token_state(
    access_token_state: tuple[OAuth2Token, str | None],
) -> tuple[OAuth2Token, dict[str, Any]]:
    token_data, state = access_token_state
    if not state:
        raise Unauthorized("No state")

    try:
        state_data = jwt.decode(
            token=state,
            secret=settings.SECRET,
            type="github_repository_benefit_oauth",
        )
    except jwt.DecodeError as e:
        raise Unauthorized("Invalid state") from e

    return (token_data, state_data)


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


@router.get(
    "/user/authorize",
    name="integrations.github_repository_benefit.user_authorize",
    tags=[Tags.INTERNAL],
)
async def user_authorize(
    request: Request,
    return_to: ReturnTo,
    auth: UserRequiredAuth,
) -> RedirectResponse:
    state = {"return_to": return_to}

    encoded_state = jwt.encode(
        data=state, secret=settings.SECRET, type="github_repository_benefit_oauth"
    )

    authorization_url = await github_oauth_client.get_authorization_url(
        redirect_uri=str(
            request.url_for("integrations.github_repository_benefit.user_callback")
        ),
        state=encoded_state,
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
) -> RedirectResponse:
    token_data, state = get_decoded_token_state(access_token_state)

    try:
        await github_repository_benefit_user_service.create_oauth_account(
            session,
            auth.user,
            token_data,
        )
    except ResourceAlreadyExists:
        existing = await github_repository_benefit_user_service.get_oauth_account(
            session, auth.user
        )
        await github_repository_benefit_user_service.update_user_info(session, existing)

    return_to = state["return_to"]
    redirect_url = get_safe_return_url(add_query_parameters(return_to))

    return RedirectResponse(redirect_url, 303)


@router.get(
    "/user/repositories",
    name="integrations.github_repository_benefit.user_repositories",
    description="Lists available repositories for this user",
    tags=[Tags.INTERNAL],
)
async def user_repositories(
    auth: UserRequiredAuth,
    session: AsyncSession = Depends(get_db_session),
) -> GitHubInvitesBenefitRepositories:
    oauth = await github_repository_benefit_user_service.get_oauth_account(
        session, auth.user
    )

    repos = await github_repository_benefit_user_service.list_repositories(
        oauth,
    )

    return GitHubInvitesBenefitRepositories(repositories=repos)


###############################################################################
# Installation
###############################################################################


@router.get(
    "/installation/install",
    name="integrations.github_repository_benefit.installation_install",
    tags=[Tags.INTERNAL],
)
async def installation_install(
    request: Request,
    auth: UserRequiredAuth,
) -> RedirectResponse:
    return RedirectResponse(
        f"https://github.com/apps/{settings.GITHUB_REPOSITORY_BENEFITS_APP_NAMESPACE}/installations/new",
        303,
    )


@router.get(
    "/installation/callback",
    name="integrations.github_repository_benefit.installation_callback",
    tags=[Tags.INTERNAL],
)
async def installation_callback(
    request: Request,
    auth: UserRequiredAuth,
) -> Response:
    await publish(
        "integrations.github_repository_benefit.installed",
        payload={},
        user_id=auth.user.id,
    )

    return Response("Installation successful, you can close this page.")
