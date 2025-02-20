import uuid
from typing import Any

import structlog
from fastapi import Depends, Query, Request
from fastapi.responses import RedirectResponse
from httpx_oauth.clients.discord import DiscordOAuth2
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.exceptions import GetProfileError
from httpx_oauth.oauth2 import BaseOAuth2, GetAccessTokenError
from pydantic import UUID4

from polar.auth.models import Customer, is_anonymous, is_customer
from polar.config import settings
from polar.customer.service import customer as customer_service
from polar.customer_session.service import customer_session as customer_session_service
from polar.exceptions import PolarError
from polar.integrations.github.client import Forbidden
from polar.kit import jwt
from polar.kit.http import ReturnTo, add_query_parameters, get_safe_return_url
from polar.logging import Logger
from polar.models.customer import CustomerOAuthAccount, CustomerOAuthPlatform
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .. import auth
from ..schemas.oauth_accounts import AuthorizeResponse

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


class OAuthCallbackError(PolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message, 400)


@router.get("/authorize", name="customer_portal.oauth_accounts.authorize")
async def authorize(
    request: Request,
    return_to: ReturnTo,
    auth_subject: auth.CustomerPortalWrite,
    platform: CustomerOAuthPlatform = Query(...),
    customer_id: UUID4 = Query(...),
    session: AsyncSession = Depends(get_db_session),
) -> AuthorizeResponse:
    customer = auth_subject.subject
    state = {
        "customer_id": str(customer.id),
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

    return AuthorizeResponse(url=authorization_url)


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

    customer_id = uuid.UUID(state_data.get("customer_id"))
    customer: Customer | None = None
    if is_customer(auth_subject):
        customer = auth_subject.subject
    elif is_anonymous(auth_subject):
        # Trust the customer ID in the state for anonymous users
        customer = await customer_service.get(session, customer_id)

    if customer is None:
        raise Forbidden("Invalid customer")

    return_to = state_data["return_to"]
    platform = CustomerOAuthPlatform(state_data["platform"])

    redirect_url = get_safe_return_url(return_to)
    # If not authenticated, create a new customer session, we trust the customer ID in the state
    if is_anonymous(auth_subject):
        token, _ = await customer_session_service.create_customer_session(
            session, customer
        )
        redirect_url = add_query_parameters(redirect_url, customer_session_token=token)

    if code is None or error is not None:
        redirect_url = add_query_parameters(
            redirect_url, error=error or "Failed to authorize."
        )
        return RedirectResponse(redirect_url, 303)

    try:
        client = OAUTH_CLIENTS[platform]
        oauth2_token_data = await client.get_access_token(
            code, str(request.url_for("customer_portal.oauth_accounts.callback"))
        )
    except GetAccessTokenError as e:
        redirect_url = add_query_parameters(
            redirect_url, error="Failed to get access token. Please try again later."
        )
        log.error("Failed to get access token", error=str(e))
        return RedirectResponse(redirect_url, 303)

    try:
        profile = await client.get_profile(oauth2_token_data["access_token"])
    except GetProfileError as e:
        redirect_url = add_query_parameters(
            redirect_url,
            error="Failed to get profile information. Please try again later.",
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

    customer.set_oauth_account(oauth_account, platform)
    session.add(customer)

    return RedirectResponse(redirect_url)
