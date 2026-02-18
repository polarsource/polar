import uuid
from collections.abc import Generator
from unittest.mock import AsyncMock, MagicMock

import dramatiq
import pytest
from dramatiq.brokers.stub import StubBroker

from polar.worker._debounce import set_debounce_key


@pytest.fixture
def stub_broker() -> Generator[StubBroker]:
    broker = StubBroker()
    broker.actor_options.update(
        {"debounce_key", "debounce_min_threshold", "debounce_max_threshold"}
    )
    yield broker
    broker.close()


@pytest.fixture
def redis() -> AsyncMock:
    pipe = AsyncMock()
    pipe.__aenter__ = AsyncMock(return_value=pipe)
    pipe.__aexit__ = AsyncMock(return_value=False)

    mock = AsyncMock()
    mock.pipeline = MagicMock(return_value=pipe)
    return mock


@pytest.mark.asyncio
class TestSetDebounceKey:
    async def test_no_debounce_key_factory(
        self, stub_broker: StubBroker, redis: AsyncMock
    ) -> None:
        """Actor without debounce_key option returns None immediately."""

        @dramatiq.actor(broker=stub_broker)
        def my_task() -> None: ...

        result = await set_debounce_key(redis, my_task, "msg-1", (), {})

        assert result is None
        redis.pipeline.assert_not_called()

    async def test_factory_returns_none_skips_debounce(
        self, stub_broker: StubBroker, redis: AsyncMock
    ) -> None:
        """When the debounce_key factory returns None, skip debouncing entirely."""

        def selective_key(kind: str, item_id: uuid.UUID) -> str | None:
            if kind != "debounce_me":
                return None
            return f"test:{kind}:{item_id}"

        @dramatiq.actor(broker=stub_broker, debounce_key=selective_key)
        def my_task(kind: str, item_id: uuid.UUID) -> None: ...

        item_id = uuid.uuid4()
        result = await set_debounce_key(
            redis, my_task, "msg-1", ("other_kind", item_id), {}
        )

        assert result is None
        redis.pipeline.assert_not_called()

    async def test_factory_returns_key_sets_debounce(
        self, stub_broker: StubBroker, redis: AsyncMock
    ) -> None:
        """When the factory returns a key, Redis state is set and delay is returned."""

        def selective_key(kind: str, item_id: uuid.UUID) -> str | None:
            if kind != "debounce_me":
                return None
            return f"test:{kind}:{item_id}"

        @dramatiq.actor(
            broker=stub_broker,
            debounce_key=selective_key,
            debounce_min_threshold=2,
        )
        def my_task(kind: str, item_id: uuid.UUID) -> None: ...

        item_id = uuid.uuid4()
        result = await set_debounce_key(
            redis, my_task, "msg-1", ("debounce_me", item_id), {}
        )

        assert result is not None
        key, delay = result
        assert key == f"debounce:test:debounce_me:{item_id}"
        assert delay == 2000  # 2 seconds * 1000ms
        redis.pipeline.assert_called_once()
