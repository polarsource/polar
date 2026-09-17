import json
import typing
from collections.abc import Sequence
from typing import Any
from uuid import UUID

from pydantic import ValidationError

from polar.exceptions import PolarError, PolarRequestValidationError
from polar.kit.utils import generate_uuid
from polar.models import Organization
from polar.models.webhook_endpoint import WebhookEventType
from polar.redis import Redis
from polar.webhook.eventstream import publish_webhook_event
from polar.webhook.webhooks import WebhookPayload, WebhookPayloadTypeAdapter

from .fixtures import SUPPORTED_EVENTS, TriggerFixtures
from .listener import has_active_listener
from .schemas import TriggerEvent, TriggerRequest, TriggerResponse


class NoActiveListener(PolarError):
    def __init__(self, organization: Organization) -> None:
        self.organization = organization
        super().__init__(
            f"No CLI is listening for {organization.slug}. "
            "Run `polar listen <url>` in another terminal first.",
            status_code=409,
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
