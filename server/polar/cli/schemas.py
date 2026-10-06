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


class SearchRequest(Schema):
    query: str = Field(
        min_length=1,
        max_length=300,
        description="Natural language question, e.g. `How can I create a customer?`",
    )
    limit: int = Field(default=3, ge=1, le=10)


class SearchResult(Schema):
    operation_id: str
    method: str
    path: str
    summary: str
    cli_command: str | None = Field(
        description="Equivalent CLI command, when the operation is exposed by the CLI."
    )
    probability: float


class SearchUsage(Schema):
    input_tokens: int
    output_tokens: int
    cost_usd: float | None = Field(
        description="What the gateway billed for this call, when it reports it."
    )


class SearchResponse(Schema):
    query: str
    model: str
    confidence: float
    usage: SearchUsage
    results: list[SearchResult]
