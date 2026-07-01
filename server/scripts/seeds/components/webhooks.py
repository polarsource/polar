"""Webhook endpoint seed component."""

from __future__ import annotations

from polar.kit.crypto import generate_token
from polar.models.webhook_endpoint import (
    WebhookEndpoint,
    WebhookEventType,
    WebhookFormat,
)
from polar.webhook.constants import WEBHOOK_SECRET_PREFIX

from scripts.seeds.base import SeedContext, Variant

EVENTS: list[WebhookEventType] = [
    WebhookEventType.order_created,
    WebhookEventType.subscription_revoked,
    WebhookEventType.benefit_grant_created,
]


class WebhooksComponent:
    key = "webhooks"
    label = "Webhook endpoint"
    default_on = False
    requires: list[str] = []
    variants: list[Variant] = []

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        ctx.session.add(
            WebhookEndpoint(
                organization_id=ctx.organization.id,
                url="https://example.com/polar-webhook",
                name="Seed webhook",
                format=WebhookFormat.raw,
                secret=generate_token(prefix=WEBHOOK_SECRET_PREFIX),
                events=EVENTS,
                enabled=True,
            )
        )
        return "1 webhook endpoint"


component = WebhooksComponent()
