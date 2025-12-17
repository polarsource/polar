import structlog

from polar.config import settings
from polar.exceptions import PolarError
from polar.logging import Logger

from .client import bot_client
from .schemas import DiscordGuild, DiscordGuildRole

log: Logger = structlog.get_logger()


class DiscordError(PolarError): ...


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
        self, guild_id: str, role_id: str, account_id: str, access_token: str
    ) -> None:
        await bot_client.add_member(
            guild_id=guild_id,
            discord_user_id=account_id,
            discord_user_access_token=access_token,
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

    async def remove_member(self, guild_id: str, account_id: str) -> None:
        await bot_client.remove_member(guild_id=guild_id, discord_user_id=account_id)

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


discord_bot = DiscordBotService()
