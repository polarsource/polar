import collections
import collections.abc
import typing

import pytest
import redis.asyncio.connection as redis_connection_module
from fakeredis import FakeAsyncRedis, FakeAsyncRedisConnection, FakeServer
from redis.asyncio import BlockingConnectionPool, Redis


def _fake_redis_pool(server: FakeServer, **kwargs: typing.Any) -> BlockingConnectionPool:
    return BlockingConnectionPool(
        connection_class=FakeAsyncRedisConnection,
        server=server,
        connected=True,
        version=(7,),
        server_type="redis",
        lua_modules=None,
        client_class=Redis,
        **kwargs,
    )


@pytest.fixture
async def redis_connection(
    monkeypatch: pytest.MonkeyPatch,
) -> collections.abc.AsyncIterator[tuple[str, Redis]]:
    server = FakeServer()
    monkeypatch.setattr(
        BlockingConnectionPool, "from_url", lambda url, **kwargs: _fake_redis_pool(server, **kwargs)
    )
    async with FakeAsyncRedis(server=server) as redis:
        yield "redis://localhost:6379", redis


# The commands the SDK sent Redis, as Redis Cloud counts its ops: a script once, whatever it runs.
@pytest.fixture
def redis_commands(monkeypatch: pytest.MonkeyPatch) -> collections.Counter[str]:
    sent: collections.Counter[str] = collections.Counter()
    pack_command = redis_connection_module.AbstractConnection.pack_command

    def counting(self: typing.Any, *args: typing.Any) -> typing.Any:
        sent[str(args[0]).lower()] += 1
        return pack_command(self, *args)

    monkeypatch.setattr(
        redis_connection_module.AbstractConnection, "pack_command", counting
    )
    return sent


async def _cost(
    redis_commands: collections.Counter[str],
    run: collections.abc.Callable[[], collections.abc.Awaitable[typing.Any]],
) -> dict[str, int]:
    redis_commands.clear()
    await run()
    return dict(redis_commands)
