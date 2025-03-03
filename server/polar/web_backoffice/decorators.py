import functools
from collections.abc import Callable, Sequence
from typing import Any, Concatenate, ParamSpec

from fastapi import Request

from .components import layout as layout_component
from .navigation import NAVIGATION

P = ParamSpec("P")

Endpoint = Callable[Concatenate[Request, P], Any]


def layout(
    title_parts: Sequence[str], active_route_name: str
) -> Callable[[Endpoint[P]], Endpoint[P]]:
    def decorator(f: Endpoint[P]) -> Endpoint[P]:
        @functools.wraps(f)
        async def wrapper(request: Request, *args: P.args, **kwargs: P.kwargs) -> Any:
            with layout_component(
                request,
                title_parts=title_parts,
                navigation=NAVIGATION,
                active_route_name=active_route_name,
            ):
                return await f(request, *args, **kwargs)

        return wrapper

    return decorator
