from typing import Any, Literal, NotRequired, TypedDict

from polar.config import settings


class SlackText(TypedDict):
    type: Literal["mrkdwn", "plain_text"]
    text: str
    emoji: NotRequired[bool]
    verbatim: NotRequired[bool]


class SlackPayload(TypedDict):
    text: str
    blocks: NotRequired[list[dict[str, Any]]]


def get_branded_slack_payload(payload: SlackPayload) -> SlackPayload:
    return {
        **payload,
        "blocks": [
            *payload.get("blocks", []),
            {
                "type": "context",
                "elements": [
                    {
                        "type": "image",
                        "image_url": settings.FAVICON_URL,
                        "alt_text": "Spaire",
                    },
                    {"type": "mrkdwn", "text": "Powered by Spaire"},
                ],
            },
        ],
    }
