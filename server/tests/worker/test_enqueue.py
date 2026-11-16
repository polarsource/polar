from datetime import timedelta
from uuid import UUID, uuid4

import dramatiq
import pytest
from pytest_mock import MockerFixture
from redis.exceptions import RedisError

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.logging import CorrelationID
from polar.models.webhook_endpoint import WebhookEventType
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


@pytest.mark.anyio
class TestFlushRequeueWindow:
    @pytest.fixture(autouse=True)
    def queued_debounce_etas(self, mocker: MockerFixture) -> None:
        mocker.patch.dict("polar.worker._debounce._queued_debounce_etas", clear=True)

    async def flush_sync(self, redis: Redis, reducer_id: UUID, *, delay: int) -> None:
        CorrelationID.set()
        jqm = JobQueueManager()
        jqm.enqueue_job(
            "reducer_bucket.sync",
            reducer_id,
            "2026-01-01T00:00:00+00:00",
            None,
            "customer",
            delay=delay,
        )
        await jqm.flush(dramatiq.get_broker(), redis)

    async def test_drops_job_already_queued(self, redis: Redis) -> None:
        reducer_id = uuid4()
        await self.flush_sync(redis, reducer_id, delay=60_000)
        await self.flush_sync(redis, reducer_id, delay=59_000)

        assert await redis.llen("dramatiq:low_priority.DQ") == 1

    async def test_enqueues_job_of_another_key(self, redis: Redis) -> None:
        await self.flush_sync(redis, uuid4(), delay=60_000)
        await self.flush_sync(redis, uuid4(), delay=60_000)

        assert await redis.llen("dramatiq:low_priority.DQ") == 2

    async def test_enqueues_job_within_requeue_window(self, redis: Redis) -> None:
        reducer_id = uuid4()
        await self.flush_sync(redis, reducer_id, delay=30_000)
        await self.flush_sync(redis, reducer_id, delay=29_000)

        assert await redis.llen("dramatiq:low_priority.DQ") == 2

    async def test_enqueues_job_when_queueing_failed(
        self, redis: Redis, mocker: MockerFixture
    ) -> None:
        reducer_id = uuid4()
        rpush = mocker.patch.object(
            JobQueueManager, "_batch_rpush_queue", side_effect=RedisError
        )
        with pytest.raises(RedisError):
            await self.flush_sync(redis, reducer_id, delay=60_000)
        mocker.stop(rpush)
        await self.flush_sync(redis, reducer_id, delay=60_000)

        assert await redis.llen("dramatiq:low_priority.DQ") == 1

    async def test_enqueues_job_of_actor_without_requeue_window(
        self, redis: Redis
    ) -> None:
        customer_id = uuid4()
        for _ in range(2):
            CorrelationID.set()
            jqm = JobQueueManager()
            jqm.enqueue_job(
                "customer.webhook",
                WebhookEventType.customer_state_changed,
                customer_id,
                delay=60_000,
            )
            await jqm.flush(dramatiq.get_broker(), redis)

        assert await redis.llen("dramatiq:medium_priority.DQ") == 2
