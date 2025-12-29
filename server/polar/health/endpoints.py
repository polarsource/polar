from fastapi import Depends, HTTPException
from redis import RedisError
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from polar.postgres import AsyncSession, get_db_session
from polar.redis import Redis, get_redis
from polar.routing import APIRouter

router = APIRouter(tags=["health"], include_in_schema=False)


@router.get("/healthz")
async def healthz(
    session: AsyncSession = Depends(get_db_session), redis: Redis = Depends(get_redis)
) -> dict[str, str]:
    raise Exception("Test from François")
    try:
        await session.execute(select(1))
    except SQLAlchemyError as e:
        raise HTTPException(status_code=503, detail="Database is not available") from e

    try:
        await redis.ping()
    except RedisError as e:
        raise HTTPException(status_code=503, detail="Redis is not available") from e

    return {"status": "ok"}
