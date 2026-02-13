import uuid

import pytest

from polar.cli.listener import (
    LISTENER_KEY_PREFIX,
    LISTENER_TTL_SECONDS,
    has_active_listener,
    mark_active,
    mark_inactive,
)
from polar.redis import Redis


@pytest.mark.asyncio
class TestMarkActive:
    async def test_sets_key(self, redis: Redis) -> None:
        org_id = uuid.uuid4()
        await mark_active(redis, org_id)

        assert await redis.exists(f"{LISTENER_KEY_PREFIX}:{org_id}") > 0

    async def test_sets_ttl(self, redis: Redis) -> None:
        org_id = uuid.uuid4()
        await mark_active(redis, org_id)

        ttl = await redis.ttl(f"{LISTENER_KEY_PREFIX}:{org_id}")
        assert 0 < ttl <= LISTENER_TTL_SECONDS

    async def test_refreshes_ttl(self, redis: Redis) -> None:
        org_id = uuid.uuid4()
        key = f"{LISTENER_KEY_PREFIX}:{org_id}"

        await mark_active(redis, org_id)
        # Simulate time passing by lowering TTL manually
        await redis.expire(key, 5)
        assert await redis.ttl(key) <= 5

        # Refresh should restore full TTL
        await mark_active(redis, org_id)
        ttl = await redis.ttl(key)
        assert ttl > 5


@pytest.mark.asyncio
class TestMarkInactive:
    async def test_deletes_key(self, redis: Redis) -> None:
        org_id = uuid.uuid4()
        await mark_active(redis, org_id)
        assert await redis.exists(f"{LISTENER_KEY_PREFIX}:{org_id}") > 0

        await mark_inactive(redis, org_id)
        assert await redis.exists(f"{LISTENER_KEY_PREFIX}:{org_id}") == 0

    async def test_noop_when_not_set(self, redis: Redis) -> None:
        org_id = uuid.uuid4()
        # Should not raise
        await mark_inactive(redis, org_id)


@pytest.mark.asyncio
class TestHasActiveListener:
    async def test_returns_true_when_active(self, redis: Redis) -> None:
        org_id = uuid.uuid4()
        await mark_active(redis, org_id)
        assert await has_active_listener(redis, org_id) is True

    async def test_returns_false_when_inactive(self, redis: Redis) -> None:
        org_id = uuid.uuid4()
        assert await has_active_listener(redis, org_id) is False

    async def test_returns_false_after_mark_inactive(self, redis: Redis) -> None:
        org_id = uuid.uuid4()
        await mark_active(redis, org_id)
        await mark_inactive(redis, org_id)
        assert await has_active_listener(redis, org_id) is False

    async def test_independent_per_org(self, redis: Redis) -> None:
        org_a = uuid.uuid4()
        org_b = uuid.uuid4()

        await mark_active(redis, org_a)

        assert await has_active_listener(redis, org_a) is True
        assert await has_active_listener(redis, org_b) is False
