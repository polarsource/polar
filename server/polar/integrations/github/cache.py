import datetime

from githubkit.cache.base import BaseCache

from polar.redis import Redis


class RedisCache(BaseCache):
    """Redis Backed Cache"""

    def __init__(self, app: str, redis: Redis) -> None:
        self.app = app
        self.redis = redis

    def get(self, key: str) -> str | None:
        raise NotImplementedError()

    async def aget(self, key: str) -> str | None:
        return await self.redis.get(f"githubkit:{self.app}:{key}")

    def set(self, key: str, value: str, ex: datetime.timedelta) -> None:
        raise NotImplementedError()

    async def aset(self, key: str, value: str, ex: datetime.timedelta) -> None:
        await self.redis.setex(f"githubkit:{self.app}:{key}", time=ex, value=value)
