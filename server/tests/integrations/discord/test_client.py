import pytest
import respx
from httpx import Response

from polar.integrations.discord.client import DiscordClient

GUILD_ID = "123456789"
ROLE_ID = "987654321"
DISCORD_USER_ID = "111222333"
ACCESS_TOKEN = "discord_access_token"

MEMBER_URL = f"https://discord.com/api/v10/guilds/{GUILD_ID}/members/{DISCORD_USER_ID}"


@pytest.fixture
def client() -> DiscordClient:
    return DiscordClient("Bot", "token")


@pytest.mark.asyncio
class TestAddMember:
    async def test_everyone_role_member_already_in_guild(
        self, client: DiscordClient, respx_mock: respx.MockRouter
    ) -> None:
        add_member = respx_mock.put(MEMBER_URL).mock(return_value=Response(204))

        await client.add_member(
            guild_id=GUILD_ID,
            discord_user_id=DISCORD_USER_ID,
            discord_user_access_token=ACCESS_TOKEN,
            role_id=GUILD_ID,
        )

        assert add_member.called
        assert len(respx_mock.calls) == 1

    async def test_everyone_role_member_added_to_guild(
        self, client: DiscordClient, respx_mock: respx.MockRouter
    ) -> None:
        add_member = respx_mock.put(MEMBER_URL).mock(return_value=Response(201))

        await client.add_member(
            guild_id=GUILD_ID,
            discord_user_id=DISCORD_USER_ID,
            discord_user_access_token=ACCESS_TOKEN,
            role_id=GUILD_ID,
        )

        assert add_member.calls.last.request.read() == (
            b'{"access_token":"discord_access_token","roles":["123456789"]}'
        )
        assert len(respx_mock.calls) == 1

    async def test_role_member_already_in_guild(
        self, client: DiscordClient, respx_mock: respx.MockRouter
    ) -> None:
        add_member = respx_mock.put(MEMBER_URL).mock(return_value=Response(204))
        add_member_role = respx_mock.put(f"{MEMBER_URL}/roles/{ROLE_ID}").mock(
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


@pytest.mark.asyncio
class TestAddMemberRole:
    async def test_everyone_role(
        self, client: DiscordClient, respx_mock: respx.MockRouter
    ) -> None:
        await client.add_member_role(
            guild_id=GUILD_ID, discord_user_id=DISCORD_USER_ID, role_id=GUILD_ID
        )

        assert len(respx_mock.calls) == 0


@pytest.mark.asyncio
class TestRemoveMemberRole:
    async def test_everyone_role(
        self, client: DiscordClient, respx_mock: respx.MockRouter
    ) -> None:
        await client.remove_member_role(
            guild_id=GUILD_ID, discord_user_id=DISCORD_USER_ID, role_id=GUILD_ID
        )

        assert len(respx_mock.calls) == 0

    async def test_role(
        self, client: DiscordClient, respx_mock: respx.MockRouter
    ) -> None:
        remove_member_role = respx_mock.delete(f"{MEMBER_URL}/roles/{ROLE_ID}").mock(
            return_value=Response(204)
        )

        await client.remove_member_role(
            guild_id=GUILD_ID, discord_user_id=DISCORD_USER_ID, role_id=ROLE_ID
        )

        assert remove_member_role.called
