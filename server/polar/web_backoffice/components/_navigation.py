import contextlib
from collections.abc import Generator
from typing import overload

from fastapi import Request
from tagflow import attr, classes, tag, text


class NavigationItem:
    """A navigation menu item that can be a link or a collapsible group of items.

    Represents an item in the backoffice navigation sidebar. Items can either
    be direct links to routes or expandable groups containing child items.
    The component supports active state detection and responsive rendering.

    Attributes:
        label: The text to display for this navigation item.
        route_name: The FastAPI route name to link to, or None for group items.
        active_route_name_prefix: Optional prefix for matching active routes.
        children: List of child NavigationItem instances for group items.
    """

    label: str
    route_name: str | None
    active_route_name_prefix: str | None
    children: list["NavigationItem"]

    @overload
    def __init__(
        self,
        label: str,
        route_name_or_children: str,
        *,
        active_route_name_prefix: str | None = None,
    ) -> None: ...

    @overload
    def __init__(
        self,
        label: str,
        route_name_or_children: list["NavigationItem"],
        *,
        active_route_name_prefix: str | None = None,
    ) -> None: ...

    def __init__(
        self,
        label: str,
        route_name_or_children: str | list["NavigationItem"],
        *,
        active_route_name_prefix: str | None = None,
    ) -> None:
        """Initialize a navigation item.

        Args:
            label: The text to display for this navigation item.
            route_name_or_children: Either a string route name for link items,
                or a list of child NavigationItem instances for group items.
            active_route_name_prefix: Optional prefix for matching active routes.
                If provided, routes starting with this prefix will be considered
                active. Useful for route families like "users_list", "users_detail".
        """
        self.label = label
        if isinstance(route_name_or_children, str):
            self.route_name = route_name_or_children
            self.children = []
        else:
            self.route_name = None
            self.children = route_name_or_children
        self.active_route_name_prefix = active_route_name_prefix

    @contextlib.contextmanager
    def render(self, request: Request, active_route_name: str) -> Generator[None]:
        """Render the navigation item as HTML.

        Generates either a simple link item or an expandable details/summary
        group depending on the item configuration. Active items receive
        special styling, and group items are automatically expanded if they
        contain the active route.

        Args:
            request: The FastAPI request object used for URL generation.
            active_route_name: The name of the currently active route, used
                for highlighting and auto-expansion.

        Yields:
            None: Context manager yields control for the navigation item.
        """
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
                        attr("open", True)
                    with tag.summary():
                        text(self.label)
                    with tag.ul():
                        for child in self.children:
                            with child.render(request, active_route_name):
                                pass
        yield

    def _is_active(self, active_route_name: str) -> bool:
        """Determine if this navigation item should be marked as active.

        Checks if the current route matches this item's route or route prefix.
        For group items, recursively checks if any child items are active.

        Args:
            active_route_name: The name of the currently active route.

        Returns:
            True if this item should be highlighted as active, False otherwise.
        """
        if self.active_route_name_prefix is not None:
            return active_route_name.startswith(self.active_route_name_prefix)
        elif self.route_name is not None:
            return self.route_name == active_route_name
        else:
            return any(child._is_active(active_route_name) for child in self.children)


__all__ = ["NavigationItem"]
