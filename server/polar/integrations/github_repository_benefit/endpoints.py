from typing import Any

from fastapi import Depends, Request, Response
from fastapi.responses import RedirectResponse
from httpx_oauth.integrations.fastapi import OAuth2AuthorizeCallback
from httpx_oauth.oauth2 import OAuth2Token

from polar.auth.dependencies import WebUserWrite
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
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

from .service import github_oauth_client, github_repository_benefit_user_service

router = APIRouter(
    prefix="/integrations/github_repository_benefit",
    tags=["integrations_github_repository_benefit", APITag.private],
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


oauth2_authorize_callback = OAuth2AuthorizeCallback(
    github_oauth_client,
    route_name="integrations.github_repository_benefit.user_callback",
)


class OAuthCallbackError(PolarRedirectionError): ...


class NotPermittedOrganizationBillingPlan(NotPermitted):
    def __init__(self) -> None:
        message = "Organization billing plan not accessible."
        super().__init__(message)


@router.get(
    "/user/authorize", name="integrations.github_repository_benefit.user_authorize"
)
async def user_authorize(
    request: Request, return_to: ReturnTo, auth_subject: WebUserWrite
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
    "/user/callback", name="integrations.github_repository_benefit.user_callback"
)
async def user_callback(
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
    access_token_state: tuple[OAuth2Token, str | None] = Depends(
        oauth2_authorize_callback
    ),
) -> RedirectResponse:
    token_data, state = get_decoded_token_state(access_token_state)

    try:
        await github_repository_benefit_user_service.create_oauth_account(
            session,
            auth_subject.subject,
            token_data,
        )
    except ResourceAlreadyExists:
        await github_repository_benefit_user_service.update_oauth_account(
            session, auth_subject.subject, token_data
        )

    return_to = state["return_to"]
    redirect_url = get_safe_return_url(add_query_parameters(return_to))

    return RedirectResponse(redirect_url, 303)


@router.get(
    "/user/repositories",
    name="integrations.github_repository_benefit.user_repositories",
    description="Lists available repositories for this user",
)
async def user_repositories(
    auth_subject: WebUserWrite,
    session: AsyncSession = Depends(get_db_session),
    redis: Redis = Depends(get_redis),
) -> GitHubInvitesBenefitRepositories:
    oauth = await github_repository_benefit_user_service.get_oauth_account(
        session, auth_subject.subject
    )

    installations = (
        await github_repository_benefit_user_service.list_user_installations(oauth)
    )

    orgs = await github_repository_benefit_user_service.list_orgs_with_billing_plans(
        redis, oauth, installations
    )

    repos = await github_repository_benefit_user_service.list_repositories(
        oauth,
        installations,
    )

    return GitHubInvitesBenefitRepositories(
        organizations=orgs,
        repositories=repos,
    )


###############################################################################
# Installation
###############################################################################


@router.get(
    "/installation/install",
    name="integrations.github_repository_benefit.installation_install",
)
async def installation_install(
    request: Request, auth_subject: WebUserWrite
) -> RedirectResponse:
    return RedirectResponse(
        f"https://github.com/apps/{settings.GITHUB_REPOSITORY_BENEFITS_APP_NAMESPACE}/installations/new",
        303,
    )


@router.get(
    "/installation/callback",
    name="integrations.github_repository_benefit.installation_callback",
)
async def installation_callback(
    request: Request, auth_subject: WebUserWrite
) -> Response:
    await publish(
        "integrations.github_repository_benefit.installed",
        payload={},
        user_id=auth_subject.subject.id,
    )

    return Response("Installation successful, you can close this page.")
