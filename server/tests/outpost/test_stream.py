import json
import uuid

import dramatiq
import pytest

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.outpost.stream import (
    Cursor,
    ReducerBucketOutpostEvent,
    enqueue,
    read_changes,
)
from polar.redis import Redis
from polar.worker import JobQueueManager


@pytest.mark.anyio
class TestEnqueue:
    async def test_publishes_once_flushed_without_a_job(
        self, redis: Redis, set_job_queue_manager_context: JobQueueManager
    ) -> None:
        organization_id = uuid.uuid4()
        reducer_id = uuid.uuid4()
        event: ReducerBucketOutpostEvent = {
            "type": "reducer_bucket",
            "reducer_id": reducer_id,
            "customer_id": None,
            "external_customer_id": "customer",
        }
        pubsub = redis.pubsub()
        await pubsub.subscribe(f"outpost:{organization_id}")
        await pubsub.get_message(timeout=1)

        enqueue(organization_id, event)
        assert await pubsub.get_message(timeout=0.1) is None
        await set_job_queue_manager_context.flush(dramatiq.get_broker(), redis)

        message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1)
        assert message is not None
        assert json.loads(message["data"]) == {
            "type": "reducer_bucket",
            "reducer_id": str(reducer_id),
            "customer_id": None,
            "external_customer_id": "customer",
        }
        assert await redis.llen("dramatiq:high_priority") == 0
        await pubsub.close()

    async def test_appends_to_the_changes_once_flushed(
        self, redis: Redis, set_job_queue_manager_context: JobQueueManager
    ) -> None:
        organization_id = uuid.uuid4()
        reducer_id = uuid.uuid4()
        event: ReducerBucketOutpostEvent = {
            "type": "reducer_bucket",
            "reducer_id": reducer_id,
            "customer_id": None,
            "external_customer_id": "customer",
        }
        key = f"outpost:changes:{organization_id}"

        enqueue(organization_id, event)
        assert await redis.xlen(key) == 0
        await set_job_queue_manager_context.flush(dramatiq.get_broker(), redis)

        [(_, fields)] = await redis.xrange(key)
        assert json.loads(fields[b"event"]) == {
            "type": "reducer_bucket",
            "reducer_id": str(reducer_id),
            "customer_id": None,
            "external_customer_id": "customer",
        }

    async def test_discards_the_changes_of_a_failed_block(
        self, redis: Redis, set_job_queue_manager_context: JobQueueManager
    ) -> None:
        organization_id = uuid.uuid4()
        event: ReducerBucketOutpostEvent = {
            "type": "reducer_bucket",
            "reducer_id": uuid.uuid4(),
            "customer_id": None,
            "external_customer_id": "customer",
        }

        with pytest.raises(RuntimeError):
            with set_job_queue_manager_context.discard_on_error():
                enqueue(organization_id, event)
                raise RuntimeError()
        await set_job_queue_manager_context.flush(dramatiq.get_broker(), redis)

        assert await redis.xlen(f"outpost:changes:{organization_id}") == 0


@pytest.mark.anyio
class TestReadChanges:
    async def test_decodes_the_events(
        self, redis: Redis, set_job_queue_manager_context: JobQueueManager
    ) -> None:
        organization_id = uuid.uuid4()
        event: ReducerBucketOutpostEvent = {
            "type": "reducer_bucket",
            "reducer_id": uuid.uuid4(),
            "customer_id": uuid.uuid4(),
            "external_customer_id": None,
        }
        enqueue(organization_id, event)
        await set_job_queue_manager_context.flush(dramatiq.get_broker(), redis)

        [(_, change)], _ = await read_changes(redis, organization_id, Cursor(0, 0), 10)

        assert change == event
