from typing import cast

import pytest
from pytest_mock import MockerFixture

from polar.integrations.tinybird.client import TinybirdPayloadTooLargeError
from polar.integrations.tinybird.schemas import TinybirdEvent
from polar.integrations.tinybird.service import DATASOURCE_EVENTS
from polar.integrations.tinybird.tasks import MAX_BATCH_EVENTS, ingest

_ingest = ingest.__wrapped__  # type: ignore[attr-defined]


def _event(event_id: str) -> TinybirdEvent:
    return cast(TinybirdEvent, {"id": event_id})


@pytest.mark.asyncio
class TestIngest:
    async def test_chunks_large_batches(self, mocker: MockerFixture) -> None:
        ingest_mock = mocker.patch(
            "polar.integrations.tinybird.tasks.client.ingest",
        )
        events = [_event(f"event-{index}") for index in range(MAX_BATCH_EVENTS + 1)]

        await _ingest(events)

        assert ingest_mock.await_count == 2
        first_call_args = ingest_mock.await_args_list[0].args
        second_call_args = ingest_mock.await_args_list[1].args
        assert first_call_args[0] == DATASOURCE_EVENTS
        assert second_call_args[0] == DATASOURCE_EVENTS
        assert len(first_call_args[1]) == MAX_BATCH_EVENTS
        assert len(second_call_args[1]) == 1

    async def test_splits_batches_on_payload_too_large(
        self, mocker: MockerFixture
    ) -> None:
        async def ingest_side_effect(
            datasource: str, events: list[TinybirdEvent]
        ) -> None:
            if len(events) > 2:
                raise TinybirdPayloadTooLargeError(size=11, max_size=10)

        ingest_mock = mocker.patch(
            "polar.integrations.tinybird.tasks.client.ingest",
            side_effect=ingest_side_effect,
        )

        await _ingest(
            [_event("event-1"), _event("event-2"), _event("event-3"), _event("event-4")]
        )

        assert [len(call.args[1]) for call in ingest_mock.await_args_list] == [4, 2, 2]

    async def test_logs_and_continues_for_single_oversized_event(
        self, mocker: MockerFixture
    ) -> None:
        async def ingest_side_effect(
            datasource: str, events: list[TinybirdEvent]
        ) -> None:
            if any(event.get("id") == "too-large" for event in events):
                raise TinybirdPayloadTooLargeError(size=11, max_size=10)

        ingest_mock = mocker.patch(
            "polar.integrations.tinybird.tasks.client.ingest",
            side_effect=ingest_side_effect,
        )
        log_error_mock = mocker.patch("polar.integrations.tinybird.tasks.log.error")

        await _ingest([_event("ok"), _event("too-large")])

        assert [len(call.args[1]) for call in ingest_mock.await_args_list] == [2, 1, 1]
        log_error_mock.assert_called_once_with(
            "tinybird.ingest.event_too_large",
            event_id="too-large",
            payload_bytes=11,
            max_payload_bytes=10,
        )
