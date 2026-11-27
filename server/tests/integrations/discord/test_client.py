from unittest.mock import Mock

import pytest
from httpx2 import Response

from polar.integrations.discord.client import DiscordClient

GUILD_ID = "123456789"
ROLE_ID = "987654321"
DISCORD_USER_ID = "111222333"
ACCESS_TOKEN = "discord_access_token"

MEMBER_URL = f"https://discord.com/api/v10/guilds/{GUILD_ID}/members/{DISCORD_USER_ID}"


@pytest.fixture
def client() -> DiscordClient:
    return DiscordClient("Bot", "token")


@pytest.mark.anyio
class TestAddMember:
    async def test_everyone_role_member_already_in_guild(
        self, client: DiscordClient, http_mocks: dict[tuple[str, str], Mock]
    ) -> None:
        add_member = http_mocks["PUT", MEMBER_URL] = Mock(return_value=Response(204))

        await client.add_member(
            guild_id=GUILD_ID,
            discord_user_id=DISCORD_USER_ID,
            discord_user_access_token=ACCESS_TOKEN,
            role_id=GUILD_ID,
        )

        assert add_member.called
        assert sum(mock.call_count for mock in http_mocks.values()) == 1

    async def test_everyone_role_member_added_to_guild(
        self, client: DiscordClient, http_mocks: dict[tuple[str, str], Mock]
    ) -> None:
        add_member = http_mocks["PUT", MEMBER_URL] = Mock(return_value=Response(201))

        await client.add_member(
            guild_id=GUILD_ID,
            discord_user_id=DISCORD_USER_ID,
            discord_user_access_token=ACCESS_TOKEN,
            role_id=GUILD_ID,
        )

        assert add_member.call_args.args[0].read() == (
            b'{"access_token":"discord_access_token","roles":["123456789"]}'
        )
        assert sum(mock.call_count for mock in http_mocks.values()) == 1

    async def test_role_member_already_in_guild(
        self, client: DiscordClient, http_mocks: dict[tuple[str, str], Mock]
    ) -> None:
        add_member = http_mocks["PUT", MEMBER_URL] = Mock(return_value=Response(204))
        add_member_role = http_mocks["PUT", f"{MEMBER_URL}/roles/{ROLE_ID}"] = Mock(
            return_value=Response(204)
        )

        await client.add_member(
            guild_id=GUILD_ID,
            discord_user_id=DISCORD_USER_ID,
            discord_user_access_token=ACCESS_TOKEN,
            role_id=ROLE_ID,
        )

        assert add_member.called
        assert add_member_role.called


@pytest.mark.anyio
class TestAddMemberRole:
    async def test_everyone_role(
        self, client: DiscordClient, http_mocks: dict[tuple[str, str], Mock]
    ) -> None:
        await client.add_member_role(
            guild_id=GUILD_ID, discord_user_id=DISCORD_USER_ID, role_id=GUILD_ID
        )

        assert sum(mock.call_count for mock in http_mocks.values()) == 0


@pytest.mark.anyio
class TestRemoveMemberRole:
    async def test_everyone_role(
        self, client: DiscordClient, http_mocks: dict[tuple[str, str], Mock]
    ) -> None:
        await client.remove_member_role(
            guild_id=GUILD_ID, discord_user_id=DISCORD_USER_ID, role_id=GUILD_ID
        )

        assert sum(mock.call_count for mock in http_mocks.values()) == 0

    async def test_role(
        self, client: DiscordClient, http_mocks: dict[tuple[str, str], Mock]
    ) -> None:
        remove_member_role = http_mocks["DELETE", f"{MEMBER_URL}/roles/{ROLE_ID}"] = (
            Mock(return_value=Response(204))
        )

        await client.remove_member_role(
            guild_id=GUILD_ID, discord_user_id=DISCORD_USER_ID, role_id=ROLE_ID
        )

        assert remove_member_role.called
