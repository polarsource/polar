import json
import time
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fakeredis import FakeAsyncRedis
from redis import RedisError

from polar.worker._queue_metrics import (
    QUEUE_NAMES,
    QUEUE_OLDEST_MESSAGE_AGE,
    QUEUE_SIZE,
    collect_queue_metrics,
)


@pytest.fixture
def redis() -> FakeAsyncRedis:
    return FakeAsyncRedis(decode_responses=True)


def get_gauge_value(gauge: Any, labels: dict[str, str]) -> float:
    return gauge.labels(**labels)._value.get()


class TestCollectQueueMetrics:
    @pytest.mark.asyncio
    async def test_empty_queues(self, redis: FakeAsyncRedis) -> None:
        await collect_queue_metrics(redis)

        for queue_name in QUEUE_NAMES:
            assert get_gauge_value(QUEUE_SIZE, {"queue": queue_name}) == 0
            assert get_gauge_value(QUEUE_OLDEST_MESSAGE_AGE, {"queue": queue_name}) == 0

    @pytest.mark.asyncio
    async def test_queue_with_messages(self, redis: FakeAsyncRedis) -> None:
        queue_name = "high_priority"
        queue_key = f"dramatiq:{queue_name}"
        msgs_key = f"dramatiq:{queue_name}.msgs"

        message_id = "msg-123"
        await redis.rpush(queue_key, message_id)
        await redis.rpush(queue_key, "msg-456")

        current_time_ms = int(time.time() * 1000)
        message_data = json.dumps({"message_timestamp": current_time_ms - 5000})
        await redis.hset(msgs_key, message_id, message_data)

        await collect_queue_metrics(redis)

        assert get_gauge_value(QUEUE_SIZE, {"queue": queue_name}) == 2
        age_value = get_gauge_value(QUEUE_OLDEST_MESSAGE_AGE, {"queue": queue_name})
        assert 4.0 <= age_value <= 10.0

    @pytest.mark.asyncio
    async def test_queue_with_eta_timestamp(self, redis: FakeAsyncRedis) -> None:
        queue_name = "medium_priority"
        queue_key = f"dramatiq:{queue_name}"
        msgs_key = f"dramatiq:{queue_name}.msgs"

        message_id = "msg-eta-123"
        await redis.rpush(queue_key, message_id)

        current_time_ms = int(time.time() * 1000)
        message_data = json.dumps({"options": {"eta": current_time_ms - 10000}})
        await redis.hset(msgs_key, message_id, message_data)

        await collect_queue_metrics(redis)

        age_value = get_gauge_value(QUEUE_OLDEST_MESSAGE_AGE, {"queue": queue_name})
        assert 9.0 <= age_value <= 15.0

    @pytest.mark.asyncio
    async def test_queue_with_no_timestamp(self, redis: FakeAsyncRedis) -> None:
        queue_name = "low_priority"
        queue_key = f"dramatiq:{queue_name}"
        msgs_key = f"dramatiq:{queue_name}.msgs"

        message_id = "msg-no-ts"
        await redis.rpush(queue_key, message_id)
        message_data = json.dumps({"actor_name": "test"})
        await redis.hset(msgs_key, message_id, message_data)

        await collect_queue_metrics(redis)

        assert get_gauge_value(QUEUE_OLDEST_MESSAGE_AGE, {"queue": queue_name}) == 0

    @pytest.mark.asyncio
    async def test_invalid_json_message(self, redis: FakeAsyncRedis) -> None:
        queue_name = "high_priority"
        queue_key = f"dramatiq:{queue_name}"
        msgs_key = f"dramatiq:{queue_name}.msgs"

        message_id = "msg-invalid"
        await redis.rpush(queue_key, message_id)
        await redis.hset(msgs_key, message_id, "not valid json {{{")

        await collect_queue_metrics(redis)

        assert get_gauge_value(QUEUE_SIZE, {"queue": queue_name}) == 1
        assert get_gauge_value(QUEUE_OLDEST_MESSAGE_AGE, {"queue": queue_name}) == 0

    @pytest.mark.asyncio
    async def test_non_dict_json_message(self, redis: FakeAsyncRedis) -> None:
        queue_name = "high_priority"
        queue_key = f"dramatiq:{queue_name}"
        msgs_key = f"dramatiq:{queue_name}.msgs"

        message_id = "msg-list"
        await redis.rpush(queue_key, message_id)
        await redis.hset(msgs_key, message_id, json.dumps([1, 2, 3]))

        await collect_queue_metrics(redis)

        assert get_gauge_value(QUEUE_OLDEST_MESSAGE_AGE, {"queue": queue_name}) == 0

    @pytest.mark.asyncio
    async def test_redis_error_on_queue_size(self) -> None:
        redis = AsyncMock()
        redis.llen.side_effect = RedisError("Connection refused")

        await collect_queue_metrics(redis)

        for queue_name in QUEUE_NAMES:
            assert get_gauge_value(QUEUE_SIZE, {"queue": queue_name}) == 0

    @pytest.mark.asyncio
    async def test_redis_error_on_queue_age(self) -> None:
        redis = AsyncMock()
        redis.llen.side_effect = [
            10,
            5,
            3,
            RedisError("timeout"),
            RedisError("timeout"),
            RedisError("timeout"),
        ]

        await collect_queue_metrics(redis)

        assert get_gauge_value(QUEUE_SIZE, {"queue": "high_priority"}) == 10
        for queue_name in QUEUE_NAMES:
            assert get_gauge_value(QUEUE_OLDEST_MESSAGE_AGE, {"queue": queue_name}) == 0

    @pytest.mark.asyncio
    async def test_message_id_exists_but_no_data(self, redis: FakeAsyncRedis) -> None:
        queue_name = "high_priority"
        queue_key = f"dramatiq:{queue_name}"

        await redis.rpush(queue_key, "orphan-msg-id")

        await collect_queue_metrics(redis)

        assert get_gauge_value(QUEUE_SIZE, {"queue": queue_name}) == 1
        assert get_gauge_value(QUEUE_OLDEST_MESSAGE_AGE, {"queue": queue_name}) == 0

    @pytest.mark.asyncio
    async def test_negative_age_clamped_to_zero(self, redis: FakeAsyncRedis) -> None:
        queue_name = "high_priority"
        queue_key = f"dramatiq:{queue_name}"
        msgs_key = f"dramatiq:{queue_name}.msgs"

        message_id = "msg-future"
        await redis.rpush(queue_key, message_id)

        future_time_ms = int((time.time() + 3600) * 1000)
        message_data = json.dumps({"message_timestamp": future_time_ms})
        await redis.hset(msgs_key, message_id, message_data)

        await collect_queue_metrics(redis)

        assert get_gauge_value(QUEUE_OLDEST_MESSAGE_AGE, {"queue": queue_name}) == 0
