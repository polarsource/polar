import contextlib
from collections.abc import Generator
from dataclasses import dataclass
from typing import Any

from tagflow import attr, tag, text


@dataclass
class Tab:
    """Configuration for a single tab."""

    label: str
    url: str | None = None
    active: bool = False
    count: int | None = None
    badge_variant: str | None = None
    # A small status dot (e.g. "needs attention"). Takes precedence over count.
    dot: bool = False
    # Extra classes on the tab element, e.g. "ml-auto" to push it to the right.
    extra_classes: str = ""


def _render_tab_indicator(tab: Tab) -> None:
    variant = tab.badge_variant or "neutral"
    if tab.dot:
        with tag.span(
            classes=f"ml-2 inline-block w-1.5 h-1.5 rounded-full bg-{variant}"
        ):
            pass
    elif tab.count is not None:
        with tag.span(classes=f"badge badge-{variant} ml-2"):
            text(str(tab.count))


@contextlib.contextmanager
def tab_nav(
    tabs: list[Tab],
    *,
    vertical: bool = False,
    **kwargs: Any,
) -> Generator[None]:
    """Create a tab navigation component.

    Generates a tabbed navigation with support for active states, counts,
    and either horizontal or vertical layouts. Useful for section switching
    in detail views or filtering in list views.

    Args:
        tabs: List of Tab objects defining the navigation items.
        vertical: If True, displays tabs vertically (sidebar style).
        **kwargs: Additional HTML attributes for the container.

    Yields:
        None: Context manager yields control for additional content.

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

    with tag.div(
        classes=" ".join(container_classes),
        role=role,
        **kwargs,
    ):
        attr("aria-orientation", orientation)

        for tab in tabs:
            # Tab link classes
            tab_classes = ["tab"]
            if tab.active:
                tab_classes.append("tab-active")
            if tab.extra_classes:
                tab_classes.append(tab.extra_classes)

            if tab.url:
                with tag.a(
                    href=tab.url,
                    classes=" ".join(tab_classes),
                    role="tab",
                ):
                    if tab.active:
                        attr("aria-selected", "true")

                    text(tab.label)
                    _render_tab_indicator(tab)
            else:
                # No URL provided, render as button for HTMX interactions
                with tag.button(
                    classes=" ".join(tab_classes),
                    role="tab",
                    type="button",
                ):
                    if tab.active:
                        attr("aria-selected", "true")

                    text(tab.label)
                    _render_tab_indicator(tab)

        yield


__all__ = ["Tab", "tab_nav"]
