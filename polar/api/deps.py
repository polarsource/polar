from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession

from polar.postgres import AsyncSessionLocal


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as db:
        yield db
