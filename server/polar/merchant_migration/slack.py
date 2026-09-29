import html
from datetime import timedelta

import structlog

from polar.config import Environment, settings
from polar.exceptions import PolarTaskError
from polar.integrations.slack.client import client as slack_client
from polar.integrations.slack.payload import (
    SlackPayload,
    SlackText,
    get_branded_slack_payload,
)
from polar.logging import Logger
from polar.models import MerchantMigration
from polar.redis import Redis

from .pan_transfer import PanTransferStep

log: Logger = structlog.get_logger()

# Marks an alert as sent so a retried or duplicated job doesn't post it twice.
SENT_KEY_TTL = timedelta(days=30)
# Held while a post is in flight. Longer than the default task time limit, and
# short so a worker killed mid-post only delays its retry instead of losing it.
IN_PROGRESS_KEY_TTL = timedelta(minutes=2)
ALERT_ENVIRONMENTS = frozenset({Environment.production, Environment.sandbox})


class SlackAlertInProgress(PolarTaskError):
    def __init__(self, key: str) -> None:
        super().__init__(f"Slack alert {key} is already being sent.")


def _migration_payload(
    title: str, migration: MerchantMigration, *, step: PanTransferStep | None = None
) -> SlackPayload:
    organization = migration.organization
    fields: list[SlackText] = [
        # The name is merchant-controlled: escaping &, < and > stops it from
        # injecting mentions or links into the mrkdwn.
        {
            "type": "mrkdwn",
            "text": (
                f"*Organization*\n{html.escape(organization.name, quote=False)}"
                f" ({organization.slug})"
            ),
        },
        {"type": "mrkdwn", "text": f"*Source*\n{migration.source_platform.label}"},
        {"type": "mrkdwn", "text": f"*Migration*\n`{migration.id}`"},
        {"type": "mrkdwn", "text": f"*Environment*\n`{settings.ENV.value}`"},
    ]
    if step is not None:
        fields.insert(2, {"type": "mrkdwn", "text": f"*Step*\n`{step.key}`"})
    backoffice_url = settings.generate_backoffice_url(
        f"/merchant-migrations/{migration.id}"
    )
    return get_branded_slack_payload(
        {
            "text": f"{title}: {organization.slug}",
            "blocks": [
                {
                    "type": "header",
                    "text": {"type": "plain_text", "text": title, "emoji": True},
                },
                {"type": "section", "fields": fields},
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "Open in backoffice",
                            },
                            "url": backoffice_url,
                        }
                    ],
                },
            ],
        }
    )


async def _post_once(redis: Redis, key: str, payload: SlackPayload) -> None:
    # The channel defaults to Polar's Ops channel, so a bot token in a local
    # .env or a test run must not post into it.
    if settings.ENV not in ALERT_ENVIRONMENTS:
        log.info("merchant_migration.slack.skipped_environment", key=key)
        return
    bot_token = settings.SLACK_BOT_TOKEN
    channel = settings.MERCHANT_MIGRATION_SLACK_CHANNEL
    if not bot_token or not channel:
        log.info("merchant_migration.slack.not_configured", key=key)
        return
    if await redis.exists(key):
        log.info("merchant_migration.slack.already_sent", key=key)
        return
    in_progress_key = f"{key}:in_progress"
    if not await redis.set(in_progress_key, "1", nx=True, ex=IN_PROGRESS_KEY_TTL):
        raise SlackAlertInProgress(key)
    try:
        if await redis.exists(key):
            return
        await slack_client.chat_post_message(
            bot_token=bot_token, channel=channel, **payload
        )
        await redis.set(key, "1", ex=SENT_KEY_TTL)
    finally:
        # Also on cancellation (task timeout, worker shutdown), so the retry
        # doesn't wait out the in-progress TTL.
        await redis.delete(in_progress_key)


async def notify_created(redis: Redis, migration: MerchantMigration) -> None:
    await _post_once(
        redis,
        f"merchant_migration:slack:created:{migration.id}",
        _migration_payload(":truck: New merchant migration", migration),
    )


async def notify_waiting_for_ops(
    redis: Redis, migration: MerchantMigration, step: PanTransferStep
) -> None:
    await _post_once(
        redis,
        f"merchant_migration:slack:waiting_for_ops:{migration.id}:{step.key}",
        _migration_payload(
            ":hourglass_flowing_sand: Merchant migration waiting for Polar Ops",
            migration,
            step=step,
        ),
    )
