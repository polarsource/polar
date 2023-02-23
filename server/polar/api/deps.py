import uuid
from typing import AsyncGenerator

from fastapi import Depends
from fastapi_users import FastAPIUsers
from polar.actions.user import UserDatabase
from polar.api.auth import UserManager, auth_backend
from polar.models import OAuthAccount, User
from polar.postgres import AsyncSessionLocal
from polar.redis import get_redis
from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as db:
        yield db


async def get_user_db(
    session: AsyncSession = Depends(get_db_session),
) -> AsyncGenerator[UserDatabase, None]:
    yield UserDatabase(session, User, OAuthAccount)


async def get_user_manager(
    user_db: UserDatabase = Depends(get_user_db),
) -> AsyncGenerator[UserManager, None]:
    yield UserManager(user_db)


fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)

__all__ = [
    "get_redis",
    "get_db_session",
    "get_user_db",
    "get_user_manager",
    "fastapi_users",
    "current_active_user",
]
