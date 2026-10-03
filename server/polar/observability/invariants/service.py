import hashlib
import json
from datetime import timedelta
from typing import Any, TypedDict

import structlog

from polar.config import settings
from polar.integrations.slack.client import client as slack_client
from polar.integrations.slack.payload import SlackPayload, get_branded_slack_payload
from polar.logging import Logger
from polar.postgres import AsyncReadSession
from polar.redis import Redis

from .rules import Invariant, InvariantError

log: Logger = structlog.get_logger()

REMINDER_INTERVAL = timedelta(hours=24)


class InvariantAlert(TypedDict):
    fingerprint: str
    thread_ts: str


def _get_alert_key(invariant_cls: type[Invariant]) -> str:
    return (
        "observability:invariants:alert:"
        f"{invariant_cls.__module__}.{invariant_cls.__qualname__}"
    )


def _get_fingerprint(error: InvariantError) -> str:
    serialized = json.dumps(
        {"message": error.message, "context": error.context},
        sort_keys=True,
        default=str,
    )
    return hashlib.sha256(serialized.encode()).hexdigest()


async def _get_alert(redis: Redis, key: str) -> InvariantAlert | None:
    value = await redis.get(key)
    if value is None:
        return None
    return json.loads(value)


def _format_invariant_failure_payload(error: InvariantError) -> SlackPayload:
    invariant_name = error.invariant.__name__
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
                "text": f"*Failure Details*\n>{error.message}",
            },
        },
        {"type": "divider"},
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*Context*\n\n```{json.dumps(error.context, indent=2, default=str)}```",
            },
        },
    ]
    return get_branded_slack_payload(
        {
            "text": f":rotating_light: Invariant check `{invariant_name}` failed",
            "blocks": blocks,
        }
    )


def _format_invariant_resolved_payload(invariant_cls: type[Invariant]) -> SlackPayload:
    invariant_name = invariant_cls.__name__
    text = f":white_check_mark: Invariant check `{invariant_name}` passes again"
    return get_branded_slack_payload(
        {
            "text": text,
            "blocks": [{"type": "section", "text": {"type": "mrkdwn", "text": text}}],
        }
    )


class InvariantService:
    async def check(
        self,
        session: AsyncReadSession,
        redis: Redis,
        invariant_cls: type[Invariant],
    ) -> None:
        if (
            invariant_cls.ENVIRONMENTS is not None
            and settings.ENV not in invariant_cls.ENVIRONMENTS
        ):
            log.debug(
                "Skipping invariant in this environment",
                invariant=invariant_cls.__name__,
                environment=settings.ENV,
            )
            return

        log.debug("Checking invariant", invariant=invariant_cls.__name__)
        invariant = invariant_cls(session)
        try:
            await invariant.check()
        except InvariantError as e:
            log.warning(
                "Invariant check failed",
                invariant=e.invariant.__name__,
                message=e.message,
                context=e.context,
            )
            await self._notify_failure(redis, e)
        else:
            log.debug("Invariant check passed", invariant=invariant_cls.__name__)
            await self._notify_resolved(redis, invariant_cls)

    async def _notify_failure(self, redis: Redis, error: InvariantError) -> None:
        if not settings.SLACK_BOT_TOKEN or not settings.SLACK_CHANNEL:
            log.warning(
                "Slack bot token or channel not configured, "
                "cannot send invariant failure notification"
            )
            return

        key = _get_alert_key(error.invariant)
        fingerprint = _get_fingerprint(error)
        alert = await _get_alert(redis, key)
        if alert is not None and alert["fingerprint"] == fingerprint:
            log.info(
                "Invariant failure already notified",
                invariant=error.invariant.__name__,
            )
            return

        payload = _format_invariant_failure_payload(error)
        if alert is not None:
            payload["thread_ts"] = alert["thread_ts"]
        response = await slack_client.chat_post_message(
            bot_token=settings.SLACK_BOT_TOKEN,
            channel=settings.SLACK_CHANNEL,
            **payload,
        )

        if alert is None:
            alert = {"fingerprint": fingerprint, "thread_ts": response["ts"]}
            await redis.set(key, json.dumps(alert), ex=REMINDER_INTERVAL, nx=True)
        else:
            alert["fingerprint"] = fingerprint
            await redis.set(key, json.dumps(alert), keepttl=True, xx=True)

    async def _notify_resolved(
        self, redis: Redis, invariant_cls: type[Invariant]
    ) -> None:
        if not settings.SLACK_BOT_TOKEN or not settings.SLACK_CHANNEL:
            return

        key = _get_alert_key(invariant_cls)
        alert = await _get_alert(redis, key)
        if alert is None:
            return

        payload = _format_invariant_resolved_payload(invariant_cls)
        payload["thread_ts"] = alert["thread_ts"]
        await slack_client.chat_post_message(
            bot_token=settings.SLACK_BOT_TOKEN,
            channel=settings.SLACK_CHANNEL,
            **payload,
        )
        await redis.delete(key)


invariant = InvariantService()
