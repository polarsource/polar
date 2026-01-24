import contextlib
from collections.abc import Generator
from dataclasses import dataclass
from typing import Any

from markupflow import Fragment


@dataclass
class Tab:
    """Configuration for a single tab."""

    label: str
    url: str | None = None
    active: bool = False
    count: int | None = None
    badge_variant: str | None = None


@contextlib.contextmanager
def tab_nav(
    tabs: list[Tab],
    *,
    vertical: bool = False,
    **kwargs: Any,
) -> Generator[Fragment]:
    """Create a tab navigation component.

    Generates a tabbed navigation with support for active states, counts,
    and either horizontal or vertical layouts. Useful for section switching
    in detail views or filtering in list views.

    Args:
        tabs: List of Tab objects defining the navigation items.
        vertical: If True, displays tabs vertically (sidebar style).
        **kwargs: Additional HTML attributes for the container.

    Yields:
        Fragment: Context manager yields control for additional content.

    Example:
        >>> tabs = [
        ...     Tab("Overview", "/org/123", active=True),
        ...     Tab("Team", "/org/123/team", count=5),
        ...     Tab("Settings", "/org/123/settings"),
        ... ]
        >>> with tab_nav(tabs):
        ...     pass
    """
    role = "tablist"
    orientation = "vertical" if vertical else "horizontal"

    # Container classes
    container_classes = ["tabs"]
    if vertical:
        container_classes.append("tabs-bordered flex-col")
    else:
        container_classes.append("tabs-bordered")

    fragment = Fragment()
    with fragment.div(
        class_=" ".join(container_classes),
        role=role,
        **kwargs,
    ):
        fragment.attr("aria-orientation", orientation)

        for tab in tabs:
            # Tab link classes
            tab_classes = ["tab"]
            if tab.active:
                tab_classes.append("tab-active")

            if tab.url:
                with fragment.a(
                    href=tab.url,
                    class_=" ".join(tab_classes),
                    role="tab",
                ):
                    if tab.active:
                        fragment.attr("aria-selected", "true")

                    fragment.text(tab.label)

                    # Optional count badge
                    if tab.count is not None:
                        variant_class = (
                            f"badge-{tab.badge_variant}"
                            if tab.badge_variant
                            else "badge-neutral"
                        )
                        with fragment.span(class_=f"badge {variant_class} ml-2"):
                            fragment.text(str(tab.count))
            else:
                # No URL provided, render as button for HTMX interactions
                with fragment.button(
                    class_=" ".join(tab_classes),
                    role="tab",
                    type="button",
                ):
                    if tab.active:
                        fragment.attr("aria-selected", "true")

                    fragment.text(tab.label)

                    if tab.count is not None:
                        variant_class = (
                            f"badge-{tab.badge_variant}"
                            if tab.badge_variant
                            else "badge-neutral"
                        )
                        with fragment.span(class_=f"badge {variant_class} ml-2"):
                            fragment.text(str(tab.count))

        yield fragment


__all__ = ["Tab", "tab_nav"]
