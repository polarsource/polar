import httpx

from polar.config import settings

from .webhook import (
    DiscordEmbed,
    DiscordEmbedField,
    DiscordPayload,
    get_branded_discord_embed,
)


async def send_internal_webhook(payload: DiscordPayload) -> None:
    """
    Send a message to the internal Polar Discord webhook.
    """
    if settings.DISCORD_WEBHOOK_URL is None:
        return

    async with httpx.AsyncClient() as client:
        await client.post(settings.DISCORD_WEBHOOK_URL, json=payload)


__all__ = [
    "DiscordPayload",
    "DiscordEmbed",
    "DiscordEmbedField",
    "get_branded_discord_embed",
    "send_internal_webhook",
]
