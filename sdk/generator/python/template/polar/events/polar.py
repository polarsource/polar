import typing
from collections.abc import Sequence

from .destination import DestinationProtocol
from .types import Event


class EventServiceProtocol(typing.Protocol):
    def ingest(self, **kwargs: typing.Any) -> typing.Any:
        ...


class PolarClientProtocol(typing.Protocol):
    events: EventServiceProtocol


class PolarDestination(DestinationProtocol):
    def __init__(self, client: PolarClientProtocol) -> None:
        self._client = client

    def ingest(self, events: Sequence[Event]) -> None:
        self._client.events.ingest(events=[self.map_event(event) for event in events])

    def map_event(self, event: Event) -> dict[str, typing.Any]:
        mapped_event: dict[str, typing.Any] = {
            "name": event["name"],
            "external_customer_id": event["account"],
        }
        if "id" in event:
            mapped_event["external_id"] = event["id"]
        if "parent_id" in event:
            mapped_event["parent_id"] = event["parent_id"]
        if "occurred_at" in event:
            mapped_event["timestamp"] = event["occurred_at"].isoformat()
        if "actor" in event:
            mapped_event["external_member_id"] = event["actor"]

        metadata: dict[str, typing.Any] = {}
        if "attributes" in event:
            metadata = {**metadata, **event["attributes"]}
        if "cost" in event:
            metadata["_cost"] = {
                "amount": str(event["cost"]["amount"] * 100),
                "currency": event["cost"]["currency"].lower(),
            }
        if "llm" in event:
            llm_metadata: dict[str, typing.Any] = {
                "vendor": event["llm"]["provider"],
                "model": event["llm"]["model"],
                "input_tokens": event["llm"]["usage"]["input_tokens"],
                "output_tokens": event["llm"]["usage"]["output_tokens"],
                "total_tokens": event["llm"]["usage"]["input_tokens"] + event["llm"]["usage"]["output_tokens"],
            }
            if "cache_read_input_tokens" in event["llm"]["usage"]:
                llm_metadata["cached_input_tokens"] = event["llm"]["usage"]["cache_read_input_tokens"]
            metadata["_llm"] = llm_metadata
        mapped_event["metadata"] = metadata

        return mapped_event


__all__ = ["PolarDestination"]
