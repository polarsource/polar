from httpx_oauth.clients.discord import DiscordOAuth2

from polar.config import settings

user_client = DiscordOAuth2(
    settings.DISCORD_CLIENT_ID,
    settings.DISCORD_CLIENT_SECRET,
    scopes=["identify", "email", "guilds.join"],
)

bot_client = DiscordOAuth2(
    settings.DISCORD_CLIENT_ID,
    settings.DISCORD_CLIENT_SECRET,
    scopes=["bot"],
)
