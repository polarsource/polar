from typing import Any

import fakeredis
import pytest
from pytest_mock import MockerFixture

from polar.worker._leader import LeaderLease, LeaderLeaseLost

KEY = "scheduler:leader"


@pytest.fixture
def redis() -> fakeredis.FakeRedis:
    return fakeredis.FakeRedis()


def _lease(redis: fakeredis.FakeRedis) -> LeaderLease:
    return LeaderLease(redis, KEY, ttl_seconds=90, poll_interval_seconds=0)  # type: ignore[arg-type]


class TestLeaderLease:
    def test_second_instance_waits_until_released(
        self, redis: fakeredis.FakeRedis, mocker: MockerFixture
    ) -> None:
        leader = _lease(redis)
        leader.acquire()

        follower = _lease(redis)
        attempts = 0
        original_set = redis.set

        def set_and_release_on_third_attempt(*args: Any, **kwargs: Any) -> Any:
            nonlocal attempts
            attempts += 1
            if attempts == 3:
                leader.release()
            return original_set(*args, **kwargs)

        mocker.patch.object(redis, "set", side_effect=set_and_release_on_third_attempt)
        follower.acquire()

        assert attempts == 3
        with pytest.raises(LeaderLeaseLost):
            leader.renew()
        follower.renew()

    def test_renew_retakes_expired_lease(self, redis: fakeredis.FakeRedis) -> None:
        leader = _lease(redis)
        leader.acquire()
        redis.delete(KEY)

        leader.renew()

        with pytest.raises(LeaderLeaseLost):
            _lease(redis).renew()

    def test_release_keeps_another_instance_lease(
        self, redis: fakeredis.FakeRedis
    ) -> None:
        stale = _lease(redis)
        stale.acquire()
        redis.delete(KEY)
        current = _lease(redis)
        current.acquire()

        stale.release()

        current.renew()
