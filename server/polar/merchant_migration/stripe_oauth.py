"""OAuth client for the Polar Stripe App.

Builds the consent URL and exchanges/refreshes tokens against the Stripe Apps
OAuth endpoints. The access token it returns is a short-lived restricted key
bound to the merchant account, minted on demand from the long-lived refresh
token; the refresh token rotates on every exchange, so the caller must persist
the new one each time.
"""

from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from polar.config import settings
from polar.exceptions import PolarError

AUTHORIZE_BASE_URL = "https://marketplace.stripe.com/oauth/v2"
TOKEN_URL = "https://api.stripe.com/v1/oauth/token"
TOKEN_REQUEST_TIMEOUT = 30.0

SCOPES = (
    "customer_read",
    "product_read",
    "plan_read",
    "subscription_read",
    "coupon_read",
    "promotion_code_read",
    "payment_method_read",
    "subscription_write",
)


class StripeOAuthError(PolarError): ...


class StripeAppNotConfigured(StripeOAuthError):
    def __init__(self) -> None:
        super().__init__("The Polar Stripe App is not configured.", 500)


@dataclass
class StripeOAuthToken:
    """A token response from the Stripe Apps OAuth endpoint. ``access_token`` is a
    short-lived restricted key (``rk_…``); ``refresh_token`` rotates on every
    exchange and must be re-persisted."""

    access_token: str
    refresh_token: str
    stripe_user_id: str
    scope: str
    livemode: bool


class StripeOAuthClient:
    def is_configured(self) -> bool:
        return bool(
            settings.STRIPE_APP_CLIENT_ID and settings.STRIPE_APP_CLIENT_LINK_ID
        )

    def build_authorize_url(self, *, state: str, redirect_uri: str) -> str:
        if not self.is_configured():
            raise StripeAppNotConfigured()
        params = {
            "client_id": settings.STRIPE_APP_CLIENT_ID,
            "response_type": "code",
            "scope": " ".join(SCOPES),
            "redirect_uri": redirect_uri,
            "state": state,
        }
        # The authorize URL is channel-scoped: omitting the chnlink segment fails
        # consent with "oauth client is not valid".
        return (
            f"{AUTHORIZE_BASE_URL}/{settings.STRIPE_APP_CLIENT_LINK_ID}"
            f"/authorize?{urlencode(params)}"
        )

    async def exchange_code(self, code: str) -> StripeOAuthToken:
        return await self._token_request(
            {"grant_type": "authorization_code", "code": code}
        )

    async def refresh(self, refresh_token: str) -> StripeOAuthToken:
        return await self._token_request(
            {"grant_type": "refresh_token", "refresh_token": refresh_token}
        )

    async def _token_request(self, data: dict[str, str]) -> StripeOAuthToken:
        if not self.is_configured():
            raise StripeAppNotConfigured()
        try:
            async with httpx.AsyncClient(timeout=TOKEN_REQUEST_TIMEOUT) as client:
                # The token exchange authenticates as the account that owns the app
                # (Polar's platform account in production).
                response = await client.post(
                    TOKEN_URL,
                    data={"client_id": settings.STRIPE_APP_CLIENT_ID, **data},
                    auth=(settings.STRIPE_SECRET_KEY, ""),
                )
        except httpx.HTTPError as e:
            raise StripeOAuthError(
                f"Stripe OAuth token request failed: {e}", 502
            ) from e
        if response.is_error:
            raise StripeOAuthError(
                f"Stripe OAuth token request failed: {response.text}", 502
            )
        try:
            payload = response.json()
            return StripeOAuthToken(
                access_token=payload["access_token"],
                refresh_token=payload["refresh_token"],
                stripe_user_id=payload["stripe_user_id"],
                scope=payload.get("scope", ""),
                livemode=payload.get("livemode", False),
            )
        except (KeyError, ValueError) as e:
            raise StripeOAuthError(
                f"Unexpected Stripe OAuth token response: {e}", 502
            ) from e


stripe_oauth = StripeOAuthClient()
