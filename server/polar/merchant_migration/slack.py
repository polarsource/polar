"""Internal Slack alerts telling Polar Ops about merchant migrations."""

import html
from datetime import timedelta
from typing import Any

import structlog

from polar.config import settings
from polar.integrations.slack.client import client as slack_client
from polar.integrations.slack.payload import SlackPayload, get_branded_slack_payload
from polar.logging import Logger
from polar.models import MerchantMigration
from polar.redis import Redis

from .pan_transfer import PanTransferStep

log: Logger = structlog.get_logger()

# Marks an alert as sent so a retried or duplicated job doesn't post it twice.
SENT_KEY_TTL = timedelta(days=30)


def _migration_payload(
    title: str, migration: MerchantMigration, *, step: PanTransferStep | None = None
) -> SlackPayload:
    organization = migration.organization
    organization_label = (
        f"{html.escape(organization.name, quote=False)} (`{organization.slug}`)"
    )
    fields: list[dict[str, Any]] = [
        {"type": "mrkdwn", "text": f"*Organization*\n{organization_label}"},
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
    bot_token = settings.SLACK_BOT_TOKEN
    channel = settings.MERCHANT_MIGRATION_SLACK_CHANNEL
    if not bot_token or not channel:
        log.info("merchant_migration.slack.not_configured", key=key)
        return
    if not await redis.set(key, "1", nx=True, ex=SENT_KEY_TTL):
        log.info("merchant_migration.slack.already_sent", key=key)
        return
    try:
        await slack_client.chat_post_message(
            bot_token=bot_token, channel=channel, **payload
        )
    except BaseException:
        # Also on cancellation (task timeout, worker shutdown): a key left behind
        # would silence the retry for the whole TTL.
        await redis.delete(key)
        raise


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
