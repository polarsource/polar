from typing import NotRequired, TypedDict

from polar.config import settings


class DiscordEmbedFooter(TypedDict):
    text: str
    icon_url: NotRequired[str]
    proxy_icon_url: NotRequired[str]


class DiscordEmbedImage(TypedDict):
    url: str
    proxy_url: NotRequired[str]
    height: NotRequired[int]
    width: NotRequired[int]


class DiscordEmbedThumbnail(DiscordEmbedImage):
    pass


class DiscordEmbedVideo(DiscordEmbedImage):
    pass


class DiscordEmbedProvider(TypedDict):
    name: NotRequired[str]
    url: NotRequired[str]


class DiscordEmbedAuthor(TypedDict):
    name: str
    url: NotRequired[str]
    icon_url: NotRequired[str]
    proxy_icon_url: NotRequired[str]


class DiscordEmbedField(TypedDict):
    name: str
    value: str
    inline: NotRequired[bool]


class DiscordEmbed(TypedDict):
    title: NotRequired[str]
    type: NotRequired[str]
    description: NotRequired[str]
    url: NotRequired[str]
    timestamp: NotRequired[str]
    color: NotRequired[int]
    footer: NotRequired[DiscordEmbedFooter]
    image: NotRequired[DiscordEmbedImage]
    thumbnail: NotRequired[DiscordEmbedThumbnail]
    video: NotRequired[DiscordEmbedVideo]
    provider: NotRequired[DiscordEmbedProvider]
    author: NotRequired[DiscordEmbedAuthor]
    fields: NotRequired[list[DiscordEmbedField]]


class DiscordPayload(TypedDict):
    content: NotRequired[str]
    embeds: NotRequired[list[DiscordEmbed]]


def get_branded_discord_embed(embed: DiscordEmbed) -> DiscordEmbed:
    return {
        "color": 25343,
        "author": {
            "name": "Polar.sh",
            "icon_url": settings.FAVICON_URL,
        },
        "thumbnail": {
            "url": settings.THUMBNAIL_URL,
        },
        "footer": {
            "text": "Powered by Polar.sh",
        },
        **embed,
    }
