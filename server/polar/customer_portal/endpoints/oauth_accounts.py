import uuid
from typing import Any

import httpx
import logfire
from fastapi import Depends, Query, Request
from fastapi.responses import RedirectResponse
from httpx_oauth.clients.discord import DiscordOAuth2
from httpx_oauth.clients.github import GitHubOAuth2
from httpx_oauth.exceptions import GetProfileError
from httpx_oauth.oauth2 import BaseOAuth2, GetAccessTokenError
from pydantic import UUID4

from polar.auth.models import Customer, is_anonymous, is_customer
from polar.benefit.grant.repository import BenefitGrantRepository
from polar.benefit.strategies.base.service import BenefitActionRequiredError
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.customer_session.service import customer_session as customer_session_service
from polar.exceptions import PolarError
from polar.integrations.github.client import Forbidden
from polar.kit import jwt
from polar.kit.http import ReturnTo, add_query_parameters, get_safe_return_url
from polar.models.benefit import BenefitType
from polar.models.customer import CustomerOAuthAccount, CustomerOAuthPlatform
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.worker import enqueue_job

from .. import auth
from ..schemas.oauth_accounts import AuthorizeResponse

router = APIRouter(prefix="/oauth-accounts", tags=["oauth-accounts", APITag.private])

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


_RATE_LIMIT_HEADERS = (
    "Retry-After",
    "X-RateLimit-Limit",
    "X-RateLimit-Remaining",
    "X-RateLimit-Reset",
    "X-RateLimit-Reset-After",
    "X-RateLimit-Bucket",
    "X-RateLimit-Global",
    "X-RateLimit-Scope",
)


def _get_response_attributes(
    response: httpx.Response | None,
) -> dict[str, str | int]:
    if response is None:
        return {}
    attrs: dict[str, str | int] = {
        "response_status": response.status_code,
    }
    if response.status_code == 429:
        for header in _RATE_LIMIT_HEADERS:
            value = response.headers.get(header)
            if value is not None:
                attrs[header] = value
    return attrs


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

    customer_repository = CustomerRepository.from_session(session)
    customer_id = uuid.UUID(state_data.get("customer_id"))
    customer: Customer | None = None
    if is_customer(auth_subject):
        customer = auth_subject.subject
    elif is_anonymous(auth_subject):
        # Trust the customer ID in the state for anonymous users
        customer = await customer_repository.get_by_id(customer_id)

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
            redirect_url,
            error=error or "Failed to authorize.",
            error_platform=platform.value,
        )
        return RedirectResponse(redirect_url, 303)

    try:
        client = OAUTH_CLIENTS[platform]
        oauth2_token_data = await client.get_access_token(
            code, str(request.url_for("customer_portal.oauth_accounts.callback"))
        )
    except GetAccessTokenError as e:
        error_message = "Failed to get access token. Please try again later."
        error_params: dict[str, str] = {
            "error": error_message,
            "error_platform": platform.value,
        }
        if e.response is not None and e.response.status_code == 429:
            error_params["error"] = f"Rate limited by {platform.value.capitalize()}."
            retry_after = e.response.headers.get("X-RateLimit-Reset-After")
            # Discord's Retry-After is in milliseconds
            if not retry_after and platform == CustomerOAuthPlatform.discord:
                retry_after_ms = e.response.headers.get("Retry-After")
                if retry_after_ms:
                    retry_after = str(int(retry_after_ms) // 1000)
            if retry_after:
                error_params["error_retry_after"] = retry_after
        redirect_url = add_query_parameters(redirect_url, **error_params)
        with logfire.span(
            "Failed to get access token",
            platform=platform,
            customer_id=str(customer.id),
        ) as span:
            for k, v in _get_response_attributes(e.response).items():
                span.set_attribute(k, v)
        return RedirectResponse(redirect_url, 303)

    try:
        profile = await client.get_profile(oauth2_token_data["access_token"])
    except GetProfileError as e:
        error_params = {
            "error": "Failed to get profile information. Please try again later.",
            "error_platform": platform.value,
        }
        redirect_url = add_query_parameters(redirect_url, **error_params)
        with logfire.span(
            "Failed to get profile",
            platform=platform,
            customer_id=str(customer.id),
        ) as span:
            for k, v in _get_response_attributes(e.response).items():
                span.set_attribute(k, v)
        return RedirectResponse(redirect_url, 303)

    oauth_account = CustomerOAuthAccount(
        access_token=oauth2_token_data["access_token"],
        expires_at=oauth2_token_data["expires_at"],
        refresh_token=oauth2_token_data["refresh_token"],
        account_id=platform.get_account_id(profile),
        account_username=platform.get_account_username(profile),
    )

    customer.set_oauth_account(oauth_account, platform)
    await customer_repository.update(customer)

    platform_benefit_type = {
        CustomerOAuthPlatform.discord: BenefitType.discord,
        CustomerOAuthPlatform.github: BenefitType.github_repository,
    }.get(platform)
    if platform_benefit_type is not None:
        grant_repository = BenefitGrantRepository.from_session(session)
        errored_grants = (
            await grant_repository.list_errored_by_customer_and_benefit_type(
                customer,
                platform_benefit_type,
                BenefitActionRequiredError.__name__,
            )
        )
        for grant in errored_grants:
            grant.properties = {
                **grant.properties,
                "account_id": oauth_account.account_id,
            }
            session.add(grant)
            enqueue_job("benefit.update", grant.id)

    return RedirectResponse(redirect_url)
