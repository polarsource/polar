import datetime

from githubkit.cache.base import BaseCache

from polar.redis import redis


class RedisCache(BaseCache):
    """Redis Backed Cache"""

    def __init__(self) -> None:
        pass

    def get(self, key: str) -> str | None:
        raise NotImplementedError()

    async def aget(self, key: str) -> str | None:
        return await redis.get("githubkit:" + key)

    def set(self, key: str, value: str, ex: datetime.timedelta) -> None:
        raise NotImplementedError()

    async def aset(self, key: str, value: str, ex: datetime.timedelta) -> None:
        await redis.setex("githubkit:" + key, time=ex, value=value)
