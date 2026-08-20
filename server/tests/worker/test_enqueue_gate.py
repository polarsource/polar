import json
from typing import TYPE_CHECKING, Any
from uuid import UUID, uuid4

import dramatiq
import pytest
from pytest_mock import MockerFixture

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.config import settings
from polar.logging import CorrelationID
from polar.redis import Redis
from polar.worker import MAX_JOB_PAYLOAD_BYTES, JobQueueManager
from polar.worker._enqueue import EVENT_INGESTED_CHUNK_SIZE
from polar.worker._sqs import (
    SQS_MAX_BATCH_BYTES,
    actor_to_queue_name,
    get_sqs_client,
    pack_batches,
    resolve_queue_url,
)

if TYPE_CHECKING:
    from mypy_boto3_sqs.type_defs import SendMessageBatchRequestEntryTypeDef


def test_actor_to_queue_name_maps_dramatiq_queue(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "WORKER_SQS_QUEUE_PREFIX", "polar-test-tasks")

    assert (
        actor_to_queue_name("customer.state_changed")
        == "polar-test-tasks-high-priority"
    )
    assert actor_to_queue_name("dummy") == "polar-test-tasks-low-priority"
    assert actor_to_queue_name("webhook_event.send") == "polar-test-tasks-webhooks"
    assert (
        actor_to_queue_name("receipt.render")
        == "polar-test-tasks-invoices-and-receipts"
    )


def test_resolve_queue_url_falls_back_to_default(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "WORKER_SQS_QUEUE_PREFIX", "polar-test-tasks")
    client = get_sqs_client()

    def fake_get_queue_url(_client: object, queue_name: str) -> str:
        if queue_name == "polar-test-tasks-default":
            return "https://sqs.example.com/polar-test-tasks-default"
        raise client.exceptions.QueueDoesNotExist(
            {"Error": {"Code": "AWS.SimpleQueueService.NonExistentQueue"}},
            "GetQueueUrl",
        )

    mocker.patch("polar.worker._sqs.get_queue_url", side_effect=fake_get_queue_url)

    assert (
        resolve_queue_url(client, "polar-test-tasks-high-priority")
        == "https://sqs.example.com/polar-test-tasks-default"
    )


@pytest.mark.asyncio
class TestFlushGate:
    async def test_disabled_routes_everything_to_redis(
        self, redis: Redis, mocker: MockerFixture
    ) -> None:
        send_jobs = mocker.patch("polar.worker._enqueue._sqs.send_jobs")

        CorrelationID.set()
        jqm = JobQueueManager()
        jqm.enqueue_job("customer.state_changed", uuid4())
        await jqm.flush(dramatiq.get_broker(), redis)

        send_jobs.assert_not_called()
        assert await redis.llen("dramatiq:high_priority") == 1

    async def test_allowlisted_actor_routes_to_sqs(
        self, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ENABLED", True)
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {"customer.state_changed"})
        send_jobs = mocker.patch("polar.worker._enqueue._sqs.send_jobs")

        CorrelationID.set()
        customer_id = uuid4()
        jqm = JobQueueManager()
        jqm.enqueue_job("customer.state_changed", customer_id)  # HIGH priority, SQS
        jqm.enqueue_job("order.created", uuid4())  # LOW priority, Redis
        await jqm.flush(dramatiq.get_broker(), redis)

        # Allowlisted actor went to SQS, with its args intact.
        send_jobs.assert_awaited_once()
        assert send_jobs.await_args is not None
        sent = send_jobs.await_args.args[0]
        assert [job[0] for job in sent] == ["customer.state_changed"]
        assert sent[0][1] == (customer_id,)

        # Non-allowlisted actor still went to Redis; the SQS one did not.
        assert await redis.llen("dramatiq:low_priority") == 1
        assert await redis.llen("dramatiq:high_priority") == 0


@pytest.mark.asyncio
class TestFlushIngestedEventsChunking:
    async def get_low_priority_jobs(self, redis: Redis) -> list[dict[str, Any]]:
        message_ids = await redis.lrange("dramatiq:low_priority", 0, -1)
        messages = await redis.hgetall("dramatiq:low_priority.msgs")
        return [json.loads(messages[message_id]) for message_id in message_ids]

    async def test_splits_into_ordered_chunks(
        self, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch("polar.worker._enqueue.EVENT_INGESTED_CHUNK_SIZE", 3)

        CorrelationID.set()
        event_ids = [uuid4() for _ in range(8)]
        jqm = JobQueueManager()
        jqm.enqueue_events(*event_ids)
        await jqm.flush(dramatiq.get_broker(), redis)

        chunks = [job["args"][0] for job in await self.get_low_priority_jobs(redis)]
        assert [len(chunk) for chunk in chunks] == [3, 3, 2]
        assert [UUID(event_id) for chunk in chunks for event_id in chunk] == event_ids

    async def test_each_job_fits_the_sqs_message_limit(self, redis: Redis) -> None:
        CorrelationID.set()
        jqm = JobQueueManager()
        jqm.enqueue_events(*(uuid4() for _ in range(EVENT_INGESTED_CHUNK_SIZE + 1)))
        await jqm.flush(dramatiq.get_broker(), redis)

        messages = await redis.hgetall("dramatiq:low_priority.msgs")
        assert len(messages) == 2
        for encoded_message in messages.values():
            assert len(encoded_message) <= SQS_MAX_BATCH_BYTES

    async def test_no_job_without_events(self, redis: Redis) -> None:
        CorrelationID.set()
        jqm = JobQueueManager()
        await jqm.flush(dramatiq.get_broker(), redis)

        assert await redis.llen("dramatiq:low_priority") == 0


class TestPackBatches:
    def make_entries(
        self, sizes: list[int]
    ) -> list["SendMessageBatchRequestEntryTypeDef"]:
        return [
            {"Id": str(index), "MessageBody": "x" * size}
            for index, size in enumerate(sizes)
        ]

    def test_empty(self) -> None:
        assert list(pack_batches([])) == []

    def test_caps_on_entry_count(self) -> None:
        batches = list(pack_batches(self.make_entries([10] * 25)))

        assert [len(batch) for batch in batches] == [10, 10, 5]

    def test_caps_on_total_bytes(self) -> None:
        batches = list(pack_batches(self.make_entries([MAX_JOB_PAYLOAD_BYTES] * 4)))

        assert [len(batch) for batch in batches] == [1, 1, 1, 1]
        for batch in batches:
            total = sum(len(entry["MessageBody"]) for entry in batch)
            assert total <= SQS_MAX_BATCH_BYTES

    def test_entry_larger_than_the_batch_limit_stays_alone(self) -> None:
        entries = self.make_entries([10, SQS_MAX_BATCH_BYTES + 1, 10])

        batches = list(pack_batches(entries))

        assert [[entry["Id"] for entry in batch] for batch in batches] == [
            ["0"],
            ["1"],
            ["2"],
        ]

    def test_every_entry_is_sent_exactly_once(self) -> None:
        entries = self.make_entries([100_000, 10, 100_000, 10, 100_000])

        batches = list(pack_batches(entries))

        assert [entry for batch in batches for entry in batch] == entries
