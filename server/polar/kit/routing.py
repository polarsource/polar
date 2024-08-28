import functools
from collections.abc import Callable
from typing import Any, ParamSpec, TypeVar

from fastapi import APIRouter as _APIRouter
from fastapi.routing import APIRoute

from polar.openapi import APITag

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


class SpeakeasyIgnoreAPIRoute(APIRoute):
    """
    A subclass of `APIRoute` that automatically adds the `x-speakeasy-ignore` property
    to the OpenAPI schema if `APITag.documented` is missing.
    """

    def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
        tags = kwargs.get("tags", [])
        if APITag.documented not in tags:
            openapi_extra = kwargs.get("openapi_extra") or {}
            kwargs["openapi_extra"] = {"x-speakeasy-ignore": True, **openapi_extra}
        super().__init__(path, endpoint, **kwargs)


_P = ParamSpec("_P")
_T = TypeVar("_T")


def _inherit_signature_from(
    _to: Callable[_P, _T],
) -> Callable[[Callable[..., _T]], Callable[_P, _T]]:
    return lambda x: x  # pyright: ignore


def get_api_router_class(route_class: type[APIRoute]) -> type[_APIRouter]:
    """
    Returns a subclass of `APIRouter` that uses the given `route_class`.
    """

    class _CustomAPIRouter(_APIRouter):
        @_inherit_signature_from(_APIRouter.__init__)
        def __init__(self, *args: Any, **kwargs: Any) -> None:
            kwargs["route_class"] = route_class
            super().__init__(*args, **kwargs)

    return _CustomAPIRouter


__all__ = ["get_api_router_class", "AutoCommitAPIRoute"]
