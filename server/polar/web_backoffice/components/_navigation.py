import contextlib
from collections.abc import Generator
from typing import overload

from fastapi import Request
from tagflow import attr, classes, tag, text


class NavigationItem:
    label: str
    route_name: str | None
    children: list["NavigationItem"]

    @overload
    def __init__(self, label: str, route_name_or_children: str) -> None: ...

    @overload
    def __init__(
        self, label: str, route_name_or_children: list["NavigationItem"]
    ) -> None: ...

    def __init__(
        self,
        label: str,
        route_name_or_children: str | list["NavigationItem"],
    ) -> None:
        self.label = label
        if isinstance(route_name_or_children, str):
            self.route_name = route_name_or_children
            self.children = []
        else:
            self.route_name = None
            self.children = route_name_or_children

    @contextlib.contextmanager
    def render(self, request: Request, active_route_name: str) -> Generator[None]:
        is_active = self._is_active(active_route_name)
        with tag.li():
            if self.route_name is not None:
                with tag.a(href=str(request.url_for(self.route_name))):
                    if is_active:
                        classes("menu-active")
                    text(self.label)
            elif self.children:
                with tag.details():
                    if is_active:
                        attr("open")
                    with tag.summary():
                        text(self.label)
                    with tag.ul():
                        for child in self.children:
                            with child.render(request, active_route_name):
                                pass
        yield

    def _is_active(self, active_route_name: str) -> bool:
        if self.route_name is not None:
            return self.route_name == active_route_name
        else:
            return any(child._is_active(active_route_name) for child in self.children)


__all__ = ["NavigationItem"]
