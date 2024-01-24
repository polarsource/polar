from typing import Any, Literal

import httpx
import structlog

from polar.config import settings

log = structlog.get_logger()

BASE_URL = "https://discord.com/api/v10"


class DiscordClient:
    def __init__(self, scheme: Literal["Bot", "Bearer"], token: str) -> None:
        self.client = httpx.AsyncClient(
            base_url=BASE_URL,
            headers={"Authorization": f"{scheme} {token}"},
        )

    async def get_me(self) -> dict[str, Any]:
        response = await self.client.get("/users/@me")
        self._handle_response(response)
        return response.json()

    async def get_guild(
        self,
        id: str,
        exclude_bot_roles: bool = True,
    ) -> dict[str, Any]:
        response = await self.client.get(f"/guilds/{id}")
        self._handle_response(response)

        data = response.json()
        if not exclude_bot_roles:
            return data

        roles = []
        given_roles = data["roles"]
        for role in given_roles:
            # Bots/integrations are considered managed.
            # https://discord.com/developers/docs/topics/permissions#role-object-role-tags-structure
            if not role["managed"]:
                roles.append(role)

        data["roles"] = roles
        return data

    async def add_member(
        self,
        guild_id: str,
        discord_user_id: str,
        discord_user_access_token: str,
        role_id: str,
        nick: str | None = None,
    ) -> None:
        endpoint = f"/guilds/{guild_id}/members/{discord_user_id}"

        data: dict[str, Any] = {}
        data["access_token"] = discord_user_access_token
        data["roles"] = [role_id]
        if nick:
            data["nick"] = nick

        response = await self.client.put(endpoint, json=data)
        self._handle_response(response)

        if response.status_code == 201:
            log.info(
                "discord.add_member.success",
                guild_id=guild_id,
                discord_user_id=discord_user_id,
            )
            return

        log.debug(
            "discord.add_member.already_present",
            guild_id=guild_id,
            discord_user_id=discord_user_id,
        )
        await self.add_member_role(
            guild_id=guild_id,
            discord_user_id=discord_user_id,
            role_id=role_id,
        )

    async def add_member_role(
        self,
        guild_id: str,
        discord_user_id: str,
        role_id: str,
    ) -> None:
        endpoint = f"/guilds/{guild_id}/members/{discord_user_id}/roles/{role_id}"

        response = await self.client.put(endpoint)
        self._handle_response(response)

        log.info(
            "discord.add_member_role.success",
            guild_id=guild_id,
            discord_user_id=discord_user_id,
            role_id=role_id,
        )
        return None

    async def remove_member_role(
        self,
        guild_id: str,
        discord_user_id: str,
        role_id: str,
    ) -> None:
        endpoint = f"/guilds/{guild_id}/members/{discord_user_id}/roles/{role_id}"

        response = await self.client.delete(endpoint)
        self._handle_response(response)

        log.info(
            "discord.remove_member_role.success",
            guild_id=guild_id,
            discord_user_id=discord_user_id,
            role_id=role_id,
        )
        return None

    def _handle_response(self, response: httpx.Response) -> httpx.Response:
        response.raise_for_status()
        return response


bot_client = DiscordClient("Bot", settings.DISCORD_BOT_TOKEN)

__all__ = ["DiscordClient", "bot_client"]
