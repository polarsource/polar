import json
import typing
from collections.abc import Sequence
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, ValidationError
from typesafe_sdk import AsyncTypeSafeClient, Choice, SystemOneResponse, TypeSafeError

from polar.config import settings
from polar.exceptions import PolarError, PolarRequestValidationError
from polar.kit.utils import generate_uuid
from polar.models import Organization
from polar.models.webhook_endpoint import WebhookEventType
from polar.redis import Redis
from polar.webhook.eventstream import publish_webhook_event
from polar.webhook.webhooks import WebhookPayload, WebhookPayloadTypeAdapter

from .catalog import CatalogEntry
from .fixtures import SUPPORTED_EVENTS, TriggerFixtures
from .listener import has_active_listener
from .schemas import (
    SearchResponse,
    SearchResult,
    SearchUsage,
    TriggerEvent,
    TriggerRequest,
    TriggerResponse,
)


class NoActiveListener(PolarError):
    def __init__(self, organization: Organization) -> None:
        self.organization = organization
        super().__init__(
            f"No CLI is listening for {organization.slug}. "
            "Run `polar listen <url>` in another terminal first.",
            status_code=409,
        )


class SearchUnavailable(PolarError):
    def __init__(self, reason: str) -> None:
        super().__init__(f"API search is unavailable: {reason}", status_code=503)


NO_MATCH = "none"
NO_MATCH_DESCRIPTION = (
    "None of the listed operations answers the question, "
    "or the question is not about the Polar API."
)
SEARCH_INSTRUCTIONS = (
    "A developer integrating Polar, a payments and billing API, asked the question "
    "in the state. Which single API operation should they call to do what they ask?"
)
SEARCH_TIMEOUT_SECONDS = 10.0


class GatewayCost(BaseModel):
    model_config = ConfigDict(extra="ignore")

    cost: str | None = None


class ProviderMetadata(BaseModel):
    model_config = ConfigDict(extra="ignore")

    gateway: GatewayCost | None = None


class GatewaySystemOneResponse(SystemOneResponse):
    provider_metadata: ProviderMetadata | None = Field(default=None)

    @property
    def cost_usd(self) -> float | None:
        gateway = self.provider_metadata.gateway if self.provider_metadata else None
        return float(gateway.cost) if gateway and gateway.cost is not None else None


async def search_routes(
    catalog: Sequence[CatalogEntry], query: str, limit: int
) -> SearchResponse:
    if not settings.VERCEL_AI_GATEWAY_API_KEY:
        raise SearchUnavailable("VERCEL_AI_GATEWAY_API_KEY is not configured")

    entries = {entry.operation_id: entry for entry in catalog}
    criteria: dict[str, str] = {
        operation_id: entry.criteria for operation_id, entry in entries.items()
    }
    criteria[NO_MATCH] = NO_MATCH_DESCRIPTION

    try:
        async with AsyncTypeSafeClient(
            api_key=settings.VERCEL_AI_GATEWAY_API_KEY,
            base_url=settings.TYPESAFE_BASE_URL,
            timeout=SEARCH_TIMEOUT_SECONDS,
        ) as client:
            response = await client.system_one(
                state=query,
                questions={
                    "operation": Choice(
                        instructions=SEARCH_INSTRUCTIONS, criteria=criteria
                    )
                },
                model=settings.TYPESAFE_MODEL,
                response_model=GatewaySystemOneResponse,
            )
    except TypeSafeError as e:
        raise SearchUnavailable(str(e)) from e

    answer = response.answers["operation"]
    if answer.type != "choice":
        raise SearchUnavailable("unexpected answer type")

    ranked = sorted(
        (
            (entries[operation_id], probability)
            for operation_id, probability in answer.probabilities.items()
            if operation_id in entries
        ),
        key=lambda item: item[1],
        reverse=True,
    )
    results = (
        []
        if answer.choice == NO_MATCH
        else [
            SearchResult(
                operation_id=entry.operation_id,
                method=entry.method,
                path=entry.path,
                summary=entry.summary,
                cli_command=entry.cli_command,
                probability=probability,
            )
            for entry, probability in ranked[:limit]
        ]
    )
    return SearchResponse(
        query=query,
        model=response.model,
        confidence=answer.confidence,
        usage=SearchUsage(
            input_tokens=response.usage.input_tokens or 0,
            output_tokens=response.usage.output_tokens or 0,
            cost_usd=response.cost_usd,
        ),
        results=results,
    )


def _event_descriptions() -> dict[WebhookEventType, str]:
    descriptions: dict[WebhookEventType, str] = {}
    union, *_ = typing.get_args(WebhookPayload)
    for payload_class in typing.get_args(union):
        (event,) = typing.get_args(payload_class.model_fields["type"].annotation)
        docstring = (payload_class.__doc__ or "").strip()
        descriptions[event] = docstring.splitlines()[0] if docstring else ""
    return descriptions


def list_trigger_events() -> Sequence[TriggerEvent]:
    descriptions = _event_descriptions()
    return [
        TriggerEvent(type=event, description=descriptions.get(event, ""))
        for event in SUPPORTED_EVENTS
    ]


def _override_error(path: str, value: Any, message: str) -> PolarRequestValidationError:
    return PolarRequestValidationError(
        [
            {
                "loc": ("body", "overrides", path),
                "msg": message,
                "type": "value_error",
                "input": value,
            }
        ]
    )


PROTECTED_OVERRIDE_PATHS = frozenset({"type"})


def _list_index(target: list[Any], segment: str, path: str, value: Any) -> int:
    try:
        index = int(segment)
    except ValueError:
        raise _override_error(
            path, value, f"{segment!r} is not a valid list index"
        ) from None
    if not -len(target) <= index < len(target):
        raise _override_error(path, value, f"List index {index} is out of range")
    return index


def apply_overrides(payload: dict[str, Any], overrides: dict[str, Any]) -> None:
    for path, value in overrides.items():
        if path in PROTECTED_OVERRIDE_PATHS:
            raise _override_error(path, value, f"{path!r} cannot be overridden")
        *parents, leaf = path.split(".")
        target: Any = payload
        for segment in parents:
            if isinstance(target, list):
                target = target[_list_index(target, segment, path, value)]
            elif isinstance(target, dict):
                target = target.setdefault(segment, {})
            else:
                raise _override_error(
                    path, value, f"Cannot set {segment!r} on a {type(target).__name__}"
                )
        if isinstance(target, list):
            target[_list_index(target, leaf, path, value)] = value
        elif isinstance(target, dict):
            target[leaf] = value
        else:
            raise _override_error(
                path, value, f"Cannot set {leaf!r} on a {type(target).__name__}"
            )


def _lookup(payload: Any, path: str) -> Any:
    target = payload
    for segment in path.split("."):
        if isinstance(target, list):
            target = target[int(segment)]
        elif isinstance(target, dict) and segment in target:
            target = target[segment]
        else:
            raise KeyError(segment)
    return target


def _reject_dropped_overrides(
    serialized: dict[str, Any], overrides: dict[str, Any]
) -> None:
    for path, value in overrides.items():
        try:
            _lookup(serialized, path)
        except KeyError, IndexError, ValueError:
            raise _override_error(
                path, value, f"{path!r} is not a field of this payload"
            ) from None


async def trigger_event(
    redis: Redis, organization: Organization, request: TriggerRequest
) -> TriggerResponse:
    fixtures = TriggerFixtures(organization, seed=request.seed)
    payload = json.loads(fixtures.build(request.event).get_raw_payload())
    apply_overrides(payload, request.overrides)

    try:
        validated = WebhookPayloadTypeAdapter.validate_python(payload)
    except ValidationError as e:
        raise PolarRequestValidationError(
            [
                {
                    "loc": ("body", "overrides", *error["loc"]),
                    "msg": error["msg"],
                    "type": error["type"],
                    "input": error["input"],
                }
                for error in e.errors()
            ]
        ) from e

    raw_payload = validated.get_raw_payload()
    serialized = json.loads(raw_payload)
    _reject_dropped_overrides(serialized, request.overrides)

    webhook_event_id: UUID = generate_uuid()
    if request.deliver:
        if not await has_active_listener(redis, organization.id):
            raise NoActiveListener(organization)
        await publish_webhook_event(
            organization_id=organization.id,
            payload=raw_payload,
            webhook_event_id=webhook_event_id,
            triggered=True,
        )

    return TriggerResponse(
        webhook_event_id=webhook_event_id,
        event=request.event,
        delivered=request.deliver,
        payload=serialized,
    )
