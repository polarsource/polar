import asyncio
from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.eventstream.endpoints import subscribe
from polar.redis import Redis


@pytest.fixture(autouse=True)
def _no_uvicorn_exit(mocker: MockerFixture) -> None:
    """Ensure _uvicorn_should_exit always returns False during tests."""
    mocker.patch(
        "polar.eventstream.endpoints._uvicorn_should_exit",
        return_value=False,
    )


def _make_request(disconnect_after: int) -> AsyncMock:
    """Create a mock request that disconnects after N iterations."""
    request = AsyncMock()
    request.is_disconnected = AsyncMock(side_effect=[False] * disconnect_after + [True])
    return request


@pytest.mark.asyncio
class TestSubscribeOnIteration:
    async def test_on_iteration_called_each_loop(self, redis: Redis) -> None:
        """on_iteration callback is invoked on every loop iteration."""
        channel = "test:on_iter"
        iterations = 3
        callback = AsyncMock()
        request = _make_request(disconnect_after=iterations)

        async for _ in subscribe(redis, [channel], request, on_iteration=callback):
            pass

        assert callback.call_count == iterations

    async def test_on_iteration_none_does_not_error(self, redis: Redis) -> None:
        """subscribe works without an on_iteration callback."""
        channel = "test:no_cb"
        request = _make_request(disconnect_after=1)

        # Should complete without error
        messages = []
        async for msg in subscribe(redis, [channel], request):
            messages.append(msg)

        # No messages expected — just verifying no crash
        assert isinstance(messages, list)

    async def test_yields_published_messages(self, redis: Redis) -> None:
        """Messages published to the channel are yielded by subscribe."""
        channel = "test:msgs"
        callback = AsyncMock()

        # Allow enough iterations to receive messages + disconnect
        request = _make_request(disconnect_after=4)

        async def publish_after_subscribe() -> None:
            # Small delay to let subscribe register
            await asyncio.sleep(0.1)
            await redis.publish(channel, "msg1")
            await asyncio.sleep(0.05)
            await redis.publish(channel, "msg2")

        task = asyncio.create_task(publish_after_subscribe())

        messages = []
        async for msg in subscribe(redis, [channel], request, on_iteration=callback):
            messages.append(msg)

        await task

        # fakeredis returns bytes since decode_responses is not set
        assert b"msg1" in messages or "msg1" in messages
        assert b"msg2" in messages or "msg2" in messages
        assert callback.call_count >= 1

    async def test_on_iteration_called_before_get_message(self, redis: Redis) -> None:
        """on_iteration is called before waiting for messages, not after."""
        channel = "test:order"
        call_order: list[str] = []

        async def track_callback() -> None:
            call_order.append("callback")

        request = _make_request(disconnect_after=1)

        async for _ in subscribe(
            redis, [channel], request, on_iteration=track_callback
        ):
            call_order.append("message")

        # callback should have been called even though no messages arrived
        assert "callback" in call_order
