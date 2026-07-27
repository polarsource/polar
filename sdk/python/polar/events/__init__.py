import concurrent.futures
import threading
from collections.abc import Sequence

from .destination import DestinationProtocol
from .polar import PolarDestination
from .posthog import PostHogDestination
from .types import (
    AttributeValue,
    Event,
    JSONValue,
    LLMGeneration,
    LLMMessage,
    Money,
    TokenUsage,
)


class EventTrackerContext:
    def __init__(
        self,
        tracker: "EventTracker",
        account: str,
        actor: str | None = None,
        groups: dict[str, str] | None = None,
        attributes: dict[str, AttributeValue] | None = None,
    ) -> None:
        self._tracker = tracker
        self._account = account
        self._actor = actor
        self._groups = groups or {}
        self._attributes = attributes or {}

    def capture(
        self,
        name: str,
        attributes: dict[str, AttributeValue] | None = None,
        cost: Money | None = None,
        llm: LLMGeneration | None = None,
    ) -> None:
        event: Event = {
            "name": name,
            "account": self._account,
            "groups": self._groups,
            "attributes": {**self._attributes, **(attributes or {})},
        }
        if self._actor is not None:
            event["actor"] = self._actor
        if cost is not None:
            event["cost"] = cost
        if llm is not None:
            event["llm"] = llm
        self._tracker.capture(event)


class EventTracker:
    def __init__(self, destinations: Sequence[DestinationProtocol]) -> None:
        self._destinations = tuple(destinations)
        self._buffer: list[Event] = []
        self._buffer_lock = threading.Lock()
        self._executor = concurrent.futures.ThreadPoolExecutor(
            max_workers=1,
            thread_name_prefix="polar-events",
        )

    def capture(self, event: Event) -> None:
        with self._buffer_lock:
            self._buffer.append(event)

    def context(
        self,
        account: str,
        actor: str | None = None,
        groups: dict[str, str] | None = None,
        attributes: dict[str, AttributeValue] | None = None,
    ) -> EventTrackerContext:
        return EventTrackerContext(self, account, actor, groups, attributes)

    def flush(self) -> concurrent.futures.Future[None] | None:
        with self._buffer_lock:
            if not self._buffer:
                return None
            events_to_ingest = self._buffer
            self._buffer = []
        return self._executor.submit(self._ingest, events_to_ingest)

    def _ingest(self, events: Sequence[Event]) -> None:
        for destination in self._destinations:
            destination.ingest(events)


__all__ = [
    "AttributeValue",
    "DestinationProtocol",
    "Event",
    "EventTracker",
    "EventTrackerContext",
    "JSONValue",
    "LLMGeneration",
    "LLMMessage",
    "Money",
    "PolarDestination",
    "PostHogDestination",
    "TokenUsage",
]
