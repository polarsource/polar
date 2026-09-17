from typing import Any
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema
from polar.models.webhook_endpoint import WebhookEventType


class TriggerEvent(Schema):
    type: WebhookEventType
    description: str = Field(
        description="One-line description of when Polar sends this event."
    )


class TriggerRequest(Schema):
    event: WebhookEventType
    overrides: dict[str, Any] = Field(
        default_factory=dict,
        description=(
            "Payload fields to override, keyed by dotted path "
            "relative to the payload root, e.g. `data.amount`."
        ),
    )
    seed: int | None = Field(
        default=None,
        description="Seed for generated IDs and numbers, for reproducible payloads.",
    )
    deliver: bool = Field(
        default=True,
        description="Send the event to the organization's active CLI listener.",
    )


class TriggerResponse(Schema):
    webhook_event_id: UUID
    event: WebhookEventType
    delivered: bool
    payload: dict[str, Any]
