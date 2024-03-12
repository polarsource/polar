import structlog
from httpx_oauth.oauth2 import OAuth2Token

from polar.config import settings
from polar.exceptions import PolarError
from polar.logging import Logger
from polar.models import OAuthAccount, User
from polar.models.subscription_benefit import SubscriptionBenefitType
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from . import oauth
from .client import DiscordClient, bot_client
from .schemas import DiscordGuild, DiscordGuildRole

log: Logger = structlog.get_logger()


class DiscordError(PolarError):
    ...


class DiscordAccountNotConnected(DiscordError):
    def __init__(self, user: User) -> None:
        self.user = user
        message = "You don't have a Discord account connected."
        super().__init__(message)


class DiscordExpiredAccessToken(DiscordError):
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
        account_username = data["username"]

        oauth_account = OAuthAccount(
            platform=OAuthPlatform.discord,
            access_token=access_token,
            expires_at=oauth2_token_data["expires_at"],
            refresh_token=oauth2_token_data["refresh_token"],
            account_id=account_id,
            account_email=account_email,
            account_username=account_username,
            user=user,
        )
        session.add(oauth_account)
        await session.commit()

        # Make sure potential Discord benefits are granted
        enqueue_job(
            "subscription.subscription_benefit.precondition_fulfilled",
            user_id=user.id,
            subscription_benefit_type=SubscriptionBenefitType.discord,
        )

        return oauth_account

    async def update_user_info(
        self,
        session: AsyncSession,
        oauth_account: OAuthAccount,
    ) -> OAuthAccount:
        client = DiscordClient("Bearer", oauth_account.access_token)
        data = await client.get_me()

        account_email = data["email"]
        account_username = data["username"]

        oauth_account.account_email = account_email
        oauth_account.account_username = account_username

        session.add(oauth_account)

        return oauth_account

    async def get_oauth_account(
        self, session: AsyncSession, user: User
    ) -> OAuthAccount:
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

        return account


class DiscordBotService:
    async def get_guild(self, id: str) -> DiscordGuild:
        guild = await bot_client.get_guild(id)

        roles: list[DiscordGuildRole] = []
        for role in sorted(guild["roles"], key=lambda r: r["position"], reverse=True):
            # Keep standard roles
            if not role["managed"]:
                roles.append(
                    DiscordGuildRole.model_validate({**role, "is_polar_bot": False})
                )
                continue

            # Keep only our bot role
            if tags := role.get("tags"):
                if tags.get("bot_id") == settings.DISCORD_CLIENT_ID:
                    roles.append(
                        DiscordGuildRole.model_validate({**role, "is_polar_bot": True})
                    )

        return DiscordGuild(name=guild["name"], roles=roles)

    async def add_member(
        self, session: AsyncSession, guild_id: str, role_id: str, user: User
    ) -> None:
        oauth_account = await DiscordUserService().get_oauth_account(session, user)
        await bot_client.add_member(
            guild_id=guild_id,
            discord_user_id=oauth_account.account_id,
            discord_user_access_token=oauth_account.access_token,
            role_id=role_id,
        )

    async def remove_member_role(
        self, guild_id: str, role_id: str, account_id: str
    ) -> None:
        await bot_client.remove_member_role(
            guild_id=guild_id,
            discord_user_id=account_id,
            role_id=role_id,
        )

    async def is_bot_role_above_role(self, guild_id: str, role_id: str) -> bool:
        """
        Checks if our bot's role has a higher position than the one we want to grant.

        There is a hierarchy in Discord roles. For our bot to grant a specific role,
        it has to be *above* this role.
        """
        guild = await bot_client.get_guild(guild_id)
        for role in sorted(guild["roles"], key=lambda r: r["position"]):
            if tags := role.get("tags"):
                if tags.get("bot_id") == settings.DISCORD_CLIENT_ID:
                    return False
            if role["id"] == role_id:
                return True

        raise DiscordError("Roles not found")


discord_user = DiscordUserService()
discord_bot = DiscordBotService()
