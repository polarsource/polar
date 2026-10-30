from uuid import uuid4

import dramatiq
import pytest
from pytest_mock import MockerFixture
from redis.exceptions import RedisError

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.logging import CorrelationID
from polar.redis import Redis
from polar.worker import JobQueueManager


@pytest.mark.anyio
class TestFlush:
    async def test_enqueues_jobs_when_publishing_fails(
        self, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(redis, "pipeline", side_effect=RedisError)

        CorrelationID.set()
        jqm = JobQueueManager()
        jqm.enqueue_job("customer.state_changed", uuid4())
        jqm.publish("channel", "message")
        await jqm.flush(dramatiq.get_broker(), redis)

        assert await redis.llen("dramatiq:high_priority") == 1
