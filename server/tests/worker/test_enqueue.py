from datetime import timedelta
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
        mocker.patch("redis.asyncio.client.Pipeline.xadd", side_effect=RedisError)

        CorrelationID.set()
        jqm = JobQueueManager()
        jqm.enqueue_job("customer.state_changed", uuid4())
        jqm.append("stream", {"field": "value"}, retention=timedelta(hours=1))
        await jqm.flush(dramatiq.get_broker(), redis)

        assert await redis.llen("dramatiq:high_priority") == 1

    async def test_publishes_when_enqueuing_the_jobs_fails(
        self, redis: Redis, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(
            JobQueueManager, "_batch_rpush_queue", side_effect=RedisError
        )

        CorrelationID.set()
        jqm = JobQueueManager()
        jqm.enqueue_job("customer.state_changed", uuid4())
        jqm.append("stream", {"field": "value"}, retention=timedelta(hours=1))
        # The transaction committed: its entries are published whatever its jobs become.
        with pytest.raises(RedisError):
            await jqm.flush(dramatiq.get_broker(), redis)

        assert await redis.xlen("stream") == 1

    async def test_expires_a_stream_nothing_appends_to(self, redis: Redis) -> None:
        jqm = JobQueueManager()
        jqm.append("stream", {"field": "value"}, retention=timedelta(hours=1))
        await jqm.flush(dramatiq.get_broker(), redis)

        assert 0 < await redis.pttl("stream") <= 3_600_000
