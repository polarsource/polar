import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request

from .components import layout as layout_component
from .navigation import NAVIGATION


@contextlib.contextmanager
def layout(
    request: Request, breadcrumbs: Sequence[tuple[str, str]], active_route_name: str
) -> Generator[None]:
    with layout_component(
        request,
        breadcrumbs=breadcrumbs,
        navigation=NAVIGATION,
        active_route_name=active_route_name,
    ):
        yield
