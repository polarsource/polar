from typing import Any

import structlog
from fastapi import Depends, Query, Request
from fastapi.responses import RedirectResponse
from httpx_oauth.clients.discord import DiscordOAuth2
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.exceptions import GetProfileError
from httpx_oauth.oauth2 import BaseOAuth2, GetAccessTokenError

from polar.config import settings
from polar.integrations.github.client import Forbidden
from polar.kit import jwt
from polar.kit.http import ReturnTo, add_query_parameters, get_safe_return_url
from polar.logging import Logger
from polar.models.customer import CustomerOAuthAccount, CustomerOAuthPlatform
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth

router = APIRouter(prefix="/oauth-accounts", tags=["oauth-accounts", APITag.private])

log: Logger = structlog.get_logger()


OAUTH_CLIENTS: dict[CustomerOAuthPlatform, BaseOAuth2[Any]] = {
    CustomerOAuthPlatform.github: GitHubOAuth2(
        settings.GITHUB_CLIENT_ID, settings.GITHUB_CLIENT_SECRET
    ),
    CustomerOAuthPlatform.discord: DiscordOAuth2(
        settings.DISCORD_CLIENT_ID,
        settings.DISCORD_CLIENT_SECRET,
        scopes=["identify", "email", "guilds.join"],
    ),
}


@router.get("/authorize", name="customer_portal.oauth_accounts.authorize")
async def authorize(
    request: Request,
    return_to: ReturnTo,
    auth_subject: auth.CustomerPortalOAuthAccount,
    platform: CustomerOAuthPlatform = Query(...),
) -> RedirectResponse:
    state = {
        "customer_id": str(auth_subject.subject.id),
        "platform": platform,
        "return_to": return_to,
    }
    encoded_state = jwt.encode(
        data=state, secret=settings.SECRET, type="customer_oauth"
    )
    client = OAUTH_CLIENTS[platform]
    authorization_url = await client.get_authorization_url(
        redirect_uri=str(request.url_for("customer_portal.oauth_accounts.callback")),
        state=encoded_state,
    )
    return RedirectResponse(authorization_url, 303)


@router.get("/callback", name="customer_portal.oauth_accounts.callback")
async def callback(
    request: Request,
    auth_subject: auth.CustomerPortalOAuthAccount,
    state: str,
    code: str | None = None,
    error: str | None = None,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    try:
        state_data = jwt.decode(
            token=state,
            secret=settings.SECRET,
            type="customer_oauth",
        )
    except jwt.DecodeError as e:
        raise Forbidden("Invalid state") from e

    if str(auth_subject.subject.id) != state_data["customer_id"]:
        raise Forbidden("Invalid state")

    return_to = state_data["return_to"]
    platform = CustomerOAuthPlatform(state_data["platform"])

    if code is None or error is not None:
        redirect_url = get_safe_return_url(
            add_query_parameters(return_to, error=error or "Failed to authorize.")
        )
        return RedirectResponse(redirect_url, 303)

    try:
        client = OAUTH_CLIENTS[platform]
        oauth2_token_data = await client.get_access_token(
            code, str(request.url_for("customer_portal.oauth_accounts.callback"))
        )
    except GetAccessTokenError as e:
        redirect_url = get_safe_return_url(
            add_query_parameters(
                return_to, error="Failed to get access token. Please try again later."
            )
        )
        log.error("Failed to get access token", error=str(e))
        return RedirectResponse(redirect_url, 303)

    try:
        profile = await client.get_profile(oauth2_token_data["access_token"])
    except GetProfileError as e:
        redirect_url = get_safe_return_url(
            add_query_parameters(
                return_to,
                error="Failed to get profile information. Please try again later.",
            )
        )
        log.error("Failed to get account ID", error=str(e))
        return RedirectResponse(redirect_url, 303)

    oauth_account = CustomerOAuthAccount(
        access_token=oauth2_token_data["access_token"],
        expires_at=oauth2_token_data["expires_at"],
        refresh_token=oauth2_token_data["refresh_token"],
        account_id=platform.get_account_id(profile),
        account_username=platform.get_account_username(profile),
    )

    customer = auth_subject.subject
    customer.set_oauth_account(oauth_account, platform)
    session.add(customer)

    return RedirectResponse(state_data["return_to"])
