import json
import uuid
from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.cli.listener import LISTENER_KEY_PREFIX, has_active_listener
from polar.redis import Redis


@pytest.fixture
def org_id() -> uuid.UUID:
    return uuid.uuid4()


@pytest.fixture
def mock_subscribe(mocker: MockerFixture) -> MagicMock:
    """Mock subscribe to yield controlled messages, capturing on_iteration."""

    async def fake_subscribe(
        redis: Any,
        channels: list[str],
        request: Any,
        on_iteration: Any = None,
    ) -> AsyncGenerator[Any, Any]:
        # Call on_iteration once to simulate a loop tick
        if on_iteration is not None:
            await on_iteration()
        yield json.dumps({"key": "some.event", "payload": {}})

    return mocker.patch(
        "polar.cli.endpoints.subscribe",
        side_effect=fake_subscribe,
    )


@pytest.fixture
def mock_auth_subject(org_id: uuid.UUID) -> AsyncMock:
    subject = AsyncMock()
    subject.subject.id = org_id
    return subject


@pytest.fixture
def mock_request() -> AsyncMock:
    return AsyncMock()


@pytest.mark.asyncio
class TestListenEndpoint:
    async def test_mark_active_on_connect(
        self,
        redis: Redis,
        org_id: uuid.UUID,
        mock_subscribe: MagicMock,
        mock_auth_subject: AsyncMock,
        mock_request: AsyncMock,
    ) -> None:
        """mark_active is called immediately when listen() is invoked."""
        from polar.cli.endpoints import listen

        response = await listen(
            request=mock_request,
            auth_subject=mock_auth_subject,
            redis=redis,
            session=AsyncMock(),
        )

        # Before consuming the generator, the key should already be set
        assert await has_active_listener(redis, org_id) is True

        # Consume the generator to clean up
        async for _ in response.body_iterator:
            break

    async def test_mark_inactive_on_disconnect(
        self,
        redis: Redis,
        org_id: uuid.UUID,
        mock_subscribe: MagicMock,
        mock_auth_subject: AsyncMock,
        mock_request: AsyncMock,
    ) -> None:
        """mark_inactive is called when the stream generator finishes."""
        from polar.cli.endpoints import listen

        response = await listen(
            request=mock_request,
            auth_subject=mock_auth_subject,
            redis=redis,
            session=AsyncMock(),
        )

        # Fully consume the generator (simulates client disconnect)
        gen = response.body_iterator
        async for _ in gen:
            pass

        # After generator is exhausted, key should be deleted
        assert await has_active_listener(redis, org_id) is False

    async def test_mark_inactive_called_on_subscribe_error(
        self,
        redis: Redis,
        org_id: uuid.UUID,
        mock_auth_subject: AsyncMock,
        mock_request: AsyncMock,
        mocker: MockerFixture,
    ) -> None:
        """mark_inactive is called even when subscribe raises an exception."""

        async def error_subscribe(
            redis: Any,
            channels: list[str],
            request: Any,
            on_iteration: Any = None,
        ) -> AsyncGenerator[Any, Any]:
            yield json.dumps({"key": "event.1", "payload": {}})
            raise ConnectionError("connection lost")

        mocker.patch(
            "polar.cli.endpoints.subscribe",
            side_effect=error_subscribe,
        )

        from polar.cli.endpoints import listen

        response = await listen(
            request=mock_request,
            auth_subject=mock_auth_subject,
            redis=redis,
            session=AsyncMock(),
        )

        assert await has_active_listener(redis, org_id) is True

        # Consume the generator — the error in subscribe triggers the finally block
        gen = response.body_iterator
        with pytest.raises(ConnectionError):
            async for _ in gen:
                pass

        assert await has_active_listener(redis, org_id) is False

    async def test_refresh_ttl_via_on_iteration(
        self,
        redis: Redis,
        org_id: uuid.UUID,
        mock_auth_subject: AsyncMock,
        mock_request: AsyncMock,
        mocker: MockerFixture,
    ) -> None:
        """The on_iteration callback passed to subscribe refreshes the TTL."""
        captured_callback: list[Any] = []

        async def capturing_subscribe(
            redis: Any,
            channels: list[str],
            request: Any,
            on_iteration: Any = None,
        ) -> AsyncGenerator[Any, Any]:
            captured_callback.append(on_iteration)
            # Don't yield anything — we just want to capture the callback
            return
            yield  # make it an async generator

        mocker.patch(
            "polar.cli.endpoints.subscribe",
            side_effect=capturing_subscribe,
        )

        from polar.cli.endpoints import listen

        response = await listen(
            request=mock_request,
            auth_subject=mock_auth_subject,
            redis=redis,
            session=AsyncMock(),
        )

        # Consume generator to trigger subscribe call
        async for _ in response.body_iterator:
            pass

        assert len(captured_callback) == 1
        assert captured_callback[0] is not None

        # Simulate TTL nearly expired
        key = f"{LISTENER_KEY_PREFIX}:{org_id}"
        await redis.expire(key, 2)
        assert await redis.ttl(key) <= 2

        # Call the captured callback — should refresh TTL
        await captured_callback[0]()
        assert await redis.ttl(key) > 2

    async def test_first_event_is_connected(
        self,
        redis: Redis,
        org_id: uuid.UUID,
        mock_subscribe: MagicMock,
        mock_auth_subject: AsyncMock,
        mock_request: AsyncMock,
    ) -> None:
        """First SSE event is a 'connected' event with the secret."""
        from polar.cli.endpoints import listen

        response = await listen(
            request=mock_request,
            auth_subject=mock_auth_subject,
            redis=redis,
            session=AsyncMock(),
        )

        first_event = await anext(aiter(response.body_iterator))
        assert isinstance(first_event, str)
        data = json.loads(first_event)

        assert data["key"] == "connected"
        assert data["secret"] == str(org_id).replace("-", "")
        assert "ts" in data
