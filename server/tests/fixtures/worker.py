from collections.abc import Iterator
from typing import Callable

import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.redis import Redis
from polar.worker import RedisMiddleware, _set_retry_context_from_metadata


class _RetryOptions(dict[str, int]):
    def __init__(self, callback: Callable[[], None], **kwargs: int) -> None:
        super().__init__(**kwargs)
        self._callback = callback

    def __setitem__(self, key: str, value: int) -> None:
        super().__setitem__(key, value)
        self._callback()


class WorkerMessage:
    def __init__(self) -> None:
        self.options = _RetryOptions(
            self.apply,
            retries=0,
            max_retries=settings.WORKER_MAX_RETRIES,
        )
        self.apply()

    def apply(self) -> None:
        _set_retry_context_from_metadata(
            self.options.get("retries"), self.options.get("max_retries")
        )


@pytest.fixture(autouse=True)
def reset_retry_context() -> Iterator[None]:
    _set_retry_context_from_metadata(0)
    yield
    _set_retry_context_from_metadata(0)


@pytest.fixture(autouse=True)
def patch_redis_middleware(mocker: MockerFixture, redis: Redis) -> None:
    mocker.patch.object(RedisMiddleware, "get", new=lambda: redis)


@pytest.fixture
def current_message() -> Iterator[WorkerMessage]:
    message = WorkerMessage()
    yield message
    _set_retry_context_from_metadata(0)
