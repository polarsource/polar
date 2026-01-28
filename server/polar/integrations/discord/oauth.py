import httpx
from httpx_oauth.clients.discord import DiscordOAuth2

from polar.config import settings


class DiscordOAuth2WithProxy(DiscordOAuth2):
    def get_httpx_client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(proxy=settings.DISCORD_PROXY_URL or None)


user_client = DiscordOAuth2WithProxy(
    settings.DISCORD_CLIENT_ID,
    settings.DISCORD_CLIENT_SECRET,
    scopes=["identify", "email", "guilds.join"],
)

bot_client = DiscordOAuth2WithProxy(
    settings.DISCORD_CLIENT_ID,
    settings.DISCORD_CLIENT_SECRET,
    scopes=["bot"],
)
