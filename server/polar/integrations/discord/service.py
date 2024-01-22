from typing import Any

import structlog
from httpx_oauth.oauth2 import OAuth2Token

from polar.exceptions import PolarError
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession

from .client import DiscordClient

log = structlog.get_logger()


class DiscordUserError(PolarError):
    ...


class DiscordAccountNotConnected(DiscordUserError):
    def __init__(self, user: User) -> None:
        self.user = user
        message = "You don't have a Discord account connected."
        super().__init__(message)


class DiscordUserService:
    async def create_oauth_account(
        self, session: AsyncSession, user: User, oauth2_token_data: OAuth2Token
    ) -> OAuthAccount:
        access_token = oauth2_token_data["access_token"]

        client = self._get_client(access_token)
        data = await client.get_me()

        account_id = data["id"]
        account_email = data["email"]

        oauth_account = OAuthAccount(
            platform=OAuthPlatform.discord,
            access_token=access_token,
            expires_at=oauth2_token_data["expires_at"],
            refresh_token=oauth2_token_data["refresh_token"],
            account_id=account_id,
            account_email=account_email,
            user=user,
        )
        session.add(oauth_account)
        await session.commit()
        return oauth_account

    async def me(self, user: User) -> dict[str, Any]:
        account = user.get_oauth_account(OAuthPlatform.discord)
        if account is None:
            raise DiscordAccountNotConnected(user)

        client = self._get_client(account.access_token)
        return await client.get_me()

    def _get_client(self, access_token: str) -> DiscordClient:
        return DiscordClient("Bearer", access_token)


discord_user = DiscordUserService()
