from uuid import uuid4

import dramatiq
import pytest
from pytest_mock import MockerFixture

import polar.tasks  # noqa: F401  (registers actors with the broker)
from polar.config import settings
from polar.logging import CorrelationID
from polar.redis import Redis
from polar.worker import JobQueueManager
from polar.worker._sqs import actor_to_queue_name


def test_actor_to_queue_name_uses_single_worker_queue(mocker: MockerFixture) -> None:
    mocker.patch.object(settings, "WORKER_SQS_QUEUE_PREFIX", "polar-test-tasks")

    assert actor_to_queue_name("customer.state_changed") == "polar-test-tasks-default"
    assert actor_to_queue_name("dummy") == "polar-test-tasks-default"


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
