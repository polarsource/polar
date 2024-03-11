import functools
from collections.abc import Callable
from typing import Any, ParamSpec, TypeVar

from fastapi import APIRouter as _APIRouter
from fastapi.routing import APIRoute

from .db.postgres import AsyncSession


class AutoCommitAPIRoute(APIRoute):
    """
    A subclass of `APIRoute` that automatically
    commits the session after the endpoint is called.

    It allows to directly return ORM objects from the endpoint
    without having to call `session.commit()` before returning.
    """

    def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
        endpoint = self.wrap_endpoint(endpoint)
        super().__init__(path, endpoint, **kwargs)

    def wrap_endpoint(self, endpoint: Callable[..., Any]) -> Callable[..., Any]:
        @functools.wraps(endpoint)
        async def wrapped_endpoint(*args: Any, **kwargs: Any) -> Any:
            session: AsyncSession | None = None
            for arg in (args, *kwargs.values()):
                if isinstance(arg, AsyncSession):
                    session = arg
                    break

            response = await endpoint(*args, **kwargs)

            if session is not None:
                await session.commit()

            return response

        return wrapped_endpoint


_P = ParamSpec("_P")
_T = TypeVar("_T")


def _inherit_signature_from(
    _to: Callable[_P, _T],
) -> Callable[[Callable[..., _T]], Callable[_P, _T]]:
    return lambda x: x  # pyright: ignore


class APIRouter(_APIRouter):
    """
    A subclass of `APIRouter` that uses `AutoCommitAPIRoute` by default.
    """

    @_inherit_signature_from(_APIRouter.__init__)
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        kwargs["route_class"] = AutoCommitAPIRoute
        super().__init__(*args, **kwargs)


__all__ = ["APIRouter"]
