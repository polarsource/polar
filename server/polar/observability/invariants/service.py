from typing import Any

import structlog

from polar.config import settings
from polar.integrations.slack.client import SlackClient
from polar.integrations.slack.payload import SlackPayload, get_branded_slack_payload
from polar.logging import Logger
from polar.postgres import AsyncReadSession

from .rules import Invariant, InvariantError

log: Logger = structlog.get_logger()


def _format_invariant_failure_payload(
    invariant_name: str, message: str
) -> SlackPayload:
    blocks: list[dict[str, Any]] = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": ":rotating_light: Invariant Check Failed",
                "emoji": True,
            },
        },
        {
            "type": "section",
            "fields": [
                {
                    "type": "mrkdwn",
                    "text": f"*Invariant*\n`{invariant_name}`",
                },
                {
                    "type": "mrkdwn",
                    "text": f"*Environment*\n`{settings.ENV.value}`",
                },
            ],
        },
        {"type": "divider"},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Failure Details*\n>{message}",
            },
        },
    ]
    return get_branded_slack_payload(
        {
            "text": f":rotating_light: Invariant check `{invariant_name}` failed",
            "blocks": blocks,
        }
    )


class InvariantService:
    def __init__(self) -> None:
        self._slack = SlackClient()

    async def check(
        self, session: AsyncReadSession, invariant_cls: type[Invariant]
    ) -> None:
        log.debug("Checking invariant", invariant=invariant_cls.__name__)
        invariant = invariant_cls(session)
        try:
            await invariant.check()
        except InvariantError as e:
            log.warning(
                "Invariant check failed",
                invariant=e.invariant.__name__,
                message=e.message,
            )
            if not settings.SLACK_BOT_TOKEN or not settings.SLACK_CHANNEL:
                log.warning(
                    "Slack bot token or channel not configured, cannot send invariant failure notification"
                )
                return
            payload = _format_invariant_failure_payload(e.invariant.__name__, e.message)
            await self._slack.chat_post_message(
                bot_token=settings.SLACK_BOT_TOKEN,
                channel=settings.SLACK_CHANNEL,
                **payload,
            )
        else:
            log.debug("Invariant check passed", invariant=invariant_cls.__name__)


invariant = InvariantService()
