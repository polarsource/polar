
import structlog
from httpx_oauth.oauth2 import OAuth2Token

from polar.exceptions import PolarError
from polar.logging import Logger
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession

from . import oauth
from .client import DiscordClient

log: Logger = structlog.get_logger()


class DiscordUserError(PolarError):
    ...


class DiscordAccountNotConnected(DiscordUserError):
    def __init__(self, user: User) -> None:
        self.user = user
        message = "You don't have a Discord account connected."
        super().__init__(message)


class DiscordExpiredAccessToken(DiscordUserError):
    def __init__(self, user: User) -> None:
        self.user = user
        message = "The access token is expired and no refresh token is available."
        super().__init__(message, 401)


class DiscordUserService:
    async def create_oauth_account(
        self, session: AsyncSession, user: User, oauth2_token_data: OAuth2Token
    ) -> OAuthAccount:
        access_token = oauth2_token_data["access_token"]

        client = DiscordClient("Bearer", access_token)
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

    async def get_access_token(self, session: AsyncSession, user: User) -> str:
        account = user.get_oauth_account(OAuthPlatform.discord)
        if account is None:
            raise DiscordAccountNotConnected(user)

        if account.is_access_token_expired():
            if account.refresh_token is None:
                raise DiscordExpiredAccessToken(user)

            log.debug(
                "Refresh Discord access token",
                oauth_account_id=str(account.id),
                user_id=str(user.id),
            )
            refreshed_token_data = await oauth.user_client.refresh_token(
                account.refresh_token
            )
            account.access_token = refreshed_token_data["access_token"]
            account.expires_at = refreshed_token_data["expires_at"]
            account.refresh_token = refreshed_token_data["refresh_token"]
            session.add(account)
            await session.commit()

        return account.access_token


discord_user = DiscordUserService()
