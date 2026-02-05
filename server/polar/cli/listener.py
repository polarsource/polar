from uuid import UUID

from polar.redis import Redis

LISTENER_KEY_PREFIX = "cli:listening"
LISTENER_TTL_SECONDS = 30


def _key(org_id: UUID) -> str:
    return f"{LISTENER_KEY_PREFIX}:{org_id}"


async def mark_active(redis: Redis, org_id: UUID) -> None:
    await redis.set(_key(org_id), "1", ex=LISTENER_TTL_SECONDS)


async def mark_inactive(redis: Redis, org_id: UUID) -> None:
    await redis.delete(_key(org_id))


async def has_active_listener(redis: Redis, org_id: UUID) -> bool:
    return await redis.exists(_key(org_id)) > 0
