from typing import TYPE_CHECKING
from uuid import uuid4

import dramatiq
import pytest
from pytest_mock import MockerFixture

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.config import settings
from polar.logging import CorrelationID
from polar.models.webhook_endpoint import WebhookEventType
from polar.redis import Redis
from polar.worker import MAX_JOB_PAYLOAD_BYTES, JobQueueManager
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

    async def test_debounced_actor_carries_debounce_key_and_delay(
        self, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(settings, "WORKER_SQS_ENABLED", True)
        mocker.patch.object(settings, "WORKER_SQS_ACTORS", {"customer.webhook"})
        send_jobs = mocker.patch("polar.worker._enqueue._sqs.send_jobs")

        CorrelationID.set()
        customer_id = uuid4()
        jqm = JobQueueManager()
        jqm.enqueue_job(
            "customer.webhook", WebhookEventType.customer_state_changed, customer_id
        )
        await jqm.flush(dramatiq.get_broker(), redis)

        send_jobs.assert_awaited_once()
        assert send_jobs.await_args is not None
        sent = send_jobs.await_args.args[0]
        job = sent[0]
        expected_key = (
            "debounce:customer.webhook:"
            f"{WebhookEventType.customer_state_changed}:{customer_id}"
        )
        assert job.actor == "customer.webhook"
        assert job.debounce_key == expected_key
        assert job.message_id is not None
        assert job.delay == 1000
        assert await redis.exists(expected_key) == 1


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
