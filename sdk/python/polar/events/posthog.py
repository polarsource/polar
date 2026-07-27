import collections.abc
import datetime
import importlib
import typing

from .destination import DestinationProtocol
from .types import Event, LLMGeneration, Money


class PostHogClientProtocol(typing.Protocol):
    def capture(self, event: str, **kwargs: typing.Any) -> str | None: ...

    def flush(self) -> None: ...


class PostHogEvent(typing.TypedDict):
    event: str
    distinct_id: str
    properties: dict[str, typing.Any]
    groups: dict[str, str]
    timestamp: typing.NotRequired[datetime.datetime]
    uuid: typing.NotRequired[str]


def _map_llm(
    event: Event,
    llm: LLMGeneration,
) -> dict[str, typing.Any]:
    properties: dict[str, typing.Any] = {
        "$ai_span_name": event["name"],
        "$ai_trace_id": llm["trace_id"],
        "$ai_provider": llm["provider"],
        "$ai_model": llm.get("response_model", llm["model"]),
        "$ai_input_tokens": llm["usage"]["input_tokens"],
        "$ai_output_tokens": llm["usage"]["output_tokens"],
    }

    if "id" in event:
        properties["$ai_span_id"] = event["id"]
    if "parent_id" in event:
        properties["$ai_parent_id"] = event["parent_id"]
    if "session_id" in llm:
        properties["$ai_session_id"] = llm["session_id"]

    if "operation" in llm:
        properties["gen_ai.operation.name"] = llm["operation"]
    if "response_model" in llm:
        properties["gen_ai.request.model"] = llm["model"]
    if "input_messages" in llm:
        properties["$ai_input"] = llm["input_messages"]
    if "output_messages" in llm:
        properties["$ai_output_choices"] = llm["output_messages"]
    if "duration_seconds" in llm:
        properties["$ai_latency"] = llm["duration_seconds"]
    if "time_to_first_token_seconds" in llm:
        properties["$ai_time_to_first_token"] = llm["time_to_first_token_seconds"]
    if "stream" in llm:
        properties["$ai_stream"] = llm["stream"]
    if "http_status_code" in llm:
        properties["$ai_http_status"] = llm["http_status_code"]
    if "finish_reason" in llm:
        properties["$ai_stop_reason"] = llm["finish_reason"]
    if "is_error" in llm:
        properties["$ai_is_error"] = llm["is_error"]
    if "error" in llm:
        properties["$ai_error"] = llm["error"]

    usage = llm["usage"]
    has_cache_usage = False
    if "cache_read_input_tokens" in usage:
        properties["$ai_cache_read_input_tokens"] = usage["cache_read_input_tokens"]
        has_cache_usage = True
    if "cache_creation_input_tokens" in usage:
        properties["$ai_cache_creation_input_tokens"] = usage[
            "cache_creation_input_tokens"
        ]
        has_cache_usage = True
    if has_cache_usage:
        properties["$ai_cache_reporting_exclusive"] = False
    if "reasoning_output_tokens" in usage:
        properties["gen_ai.usage.reasoning.output_tokens"] = usage[
            "reasoning_output_tokens"
        ]
    return properties


def _map_cost(cost: Money, is_llm: bool) -> dict[str, typing.Any]:
    amount = float(cost["amount"])
    currency = cost["currency"].lower()
    properties: dict[str, typing.Any] = {
        "cost_amount": amount,
        "cost_currency": currency,
    }
    if is_llm and currency == "usd":
        properties["$ai_total_cost_usd"] = amount
    return properties


class PostHogDestination(DestinationProtocol):
    def __init__(
        self,
        project_api_key: str,
        *,
        host: str | None = None,
        account_group: str = "account",
        group_event_distinct_id: str = "polar-account-events",
        **client_options: typing.Any,
    ) -> None:
        try:
            posthog = importlib.import_module("posthog")
        except ImportError as error:
            raise ImportError(
                "PostHogDestination requires the optional 'posthog' dependency. "
                "Install it with `pip install polar-sdk[posthog]`."
            ) from error

        client_class = typing.cast(
            typing.Callable[..., PostHogClientProtocol],
            getattr(posthog, "PostHog"),
        )
        self._client = client_class(project_api_key, host=host, **client_options)
        self._account_group = account_group
        self._group_event_distinct_id = group_event_distinct_id

    def ingest(self, events: collections.abc.Sequence[Event]) -> None:
        for event in events:
            mapped_event = self.map_event(event)
            self._client.capture(
                mapped_event["event"],
                distinct_id=mapped_event["distinct_id"],
                properties={
                    **mapped_event["properties"],
                    "$lib": "polar-sdk",
                },
                groups=mapped_event["groups"],
                timestamp=mapped_event.get("timestamp"),
                uuid=mapped_event.get("uuid"),
            )
        self._client.flush()

    def map_event(self, event: Event) -> PostHogEvent:
        llm = event.get("llm")

        if llm is None:
            event_name = event["name"]
            observation_properties: dict[str, typing.Any] = {}
        else:
            event_name = "$ai_generation"
            observation_properties = _map_llm(event, llm)

        cost = event.get("cost")
        cost_properties = _map_cost(cost, llm is not None) if cost is not None else {}
        properties = {
            **event.get("attributes", {}),
            **observation_properties,
            **cost_properties,
        }

        groups = dict(event.get("groups", {}))
        groups[self._account_group] = event["account"]

        mapped_event = PostHogEvent(
            event=event_name,
            distinct_id=event.get("actor", self._group_event_distinct_id),
            properties=properties,
            groups=groups,
        )
        if "occurred_at" in event:
            mapped_event["timestamp"] = event["occurred_at"]
        if "id" in event:
            mapped_event["uuid"] = event["id"]
        return mapped_event


__all__ = ["PostHogDestination"]
