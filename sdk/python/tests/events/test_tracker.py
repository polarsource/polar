import collections.abc
import threading

from polar.events import Event, EventTracker


class BlockingDestination:
    def __init__(self) -> None:
        self.calls: list[list[Event]] = []
        self.started = threading.Event()
        self.release = threading.Event()
        self.thread_id: int | None = None

    def ingest(self, events: collections.abc.Sequence[Event]) -> None:
        self.thread_id = threading.get_ident()
        self.started.set()
        if not self.release.wait(timeout=1):
            raise TimeoutError
        self.calls.append(list(events))


def test_flush_ingests_events_in_background() -> None:
    destination = BlockingDestination()
    tracker = EventTracker([destination])
    event: Event = {
        "name": "invoice.generated",
        "account": "org_123",
    }
    tracker.capture(event)

    future = tracker.flush()

    assert future is not None
    assert destination.started.wait(timeout=1)
    assert destination.thread_id != threading.get_ident()
    assert not future.done()

    destination.release.set()
    future.result(timeout=1)

    assert destination.calls == [[event]]


def test_flush_keeps_new_events_for_the_next_batch() -> None:
    destination = BlockingDestination()
    tracker = EventTracker([destination])
    first_event: Event = {
        "name": "invoice.generated",
        "account": "org_123",
    }
    second_event: Event = {
        "name": "invoice.sent",
        "account": "org_123",
    }
    tracker.capture(first_event)
    first_future = tracker.flush()
    assert destination.started.wait(timeout=1)

    tracker.capture(second_event)
    second_future = tracker.flush()
    destination.release.set()

    assert first_future is not None
    assert second_future is not None
    first_future.result(timeout=1)
    second_future.result(timeout=1)
    assert destination.calls == [[first_event], [second_event]]
