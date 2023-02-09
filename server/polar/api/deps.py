import uuid
from typing import AsyncGenerator

from fastapi import Depends
from fastapi_users import FastAPIUsers
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy.ext.asyncio import AsyncSession

from polar.api.auth import UserManager, auth_backend
from polar.models import OAuthAccount, User
from polar.postgres import AsyncSessionLocal


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as db:
        yield db


async def get_user_db(
    session: AsyncSession = Depends(get_db_session),
):
    yield SQLAlchemyUserDatabase(session, User, OAuthAccount)


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)


fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
