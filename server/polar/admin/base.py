from collections.abc import AsyncIterator

from asgi_admin.integrations.sqlalchemy import RepositoryBase
from asgi_admin.repository import Model
from starlette.requests import Request


async def get_repository(
    repository_class: type[RepositoryBase[Model]], request: Request
) -> AsyncIterator[RepositoryBase[Model]]:
    async with request.state.async_sessionmaker() as session:
        yield repository_class(session)
        await session.commit()


__all__ = ["get_repository"]
