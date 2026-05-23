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
    def render(
        self,
        request: Request,
        active_route_name: str,
        active_override: bool | None = None,
    ) -> Generator[None]:
        """Render the navigation item as HTML.

        Generates either a simple link item or an expandable details/summary
        group depending on the item configuration. Active items receive
        special styling, and group items are automatically expanded if they
        contain the active route.

        Args:
            request: The FastAPI request object used for URL generation.
            active_route_name: The name of the currently active route, used
                for highlighting and auto-expansion.
            active_override: When provided, overrides the computed
                active state. The sibling renderer (``menu``) uses this
                to break prefix ties — when several items match the
                active route via overlapping prefixes, only the most
                specific (longest-prefix) one stays highlighted.

        Yields:
            None: Context manager yields control for the navigation item.
        """
        is_active = (
            active_override
            if active_override is not None
            else self._is_active(active_route_name)
        )
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

    def active_match_specificity(self, active_route_name: str) -> int:
        """How specifically this item matches the active route.

        Higher = more specific. Used by ``menu`` to break ties when
        several sibling items match the same route via overlapping
        prefixes (e.g. ``agent_runs:`` vs ``agent_runs:dashboard``):
        only the longest-prefix match stays highlighted. Returns -1
        when the item does not match at all.
        """

        if not self._is_active(active_route_name):
            return -1
        if self.active_route_name_prefix is not None:
            return len(self.active_route_name_prefix)
        if self.route_name is not None:
            # An exact route-name match is maximally specific.
            return len(active_route_name) + 1
        return 0


__all__ = ["NavigationItem"]
