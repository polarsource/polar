import collections.abc
import contextlib
import typing

from outpost.env import Environment
from outpost.reducer import EventKey, Updates
from outpost.storage.memory import MemoryStorage
from outpost.storage.redis import RedisStorage


class Storage(typing.Protocol):
    @classmethod
    def create(
        cls, env: Environment
    ) -> contextlib.AbstractAsyncContextManager[typing.Self]: ...

    async def write_updates(self, updates: Updates) -> None: ...

    async def claim(self, keys: collections.abc.Sequence[EventKey]) -> list[bool]: ...


def create_storage(env: Environment) -> contextlib.AbstractAsyncContextManager[Storage]:
    if env.redis_url is None:
        return MemoryStorage.create(env)
    return RedisStorage.create(env)
