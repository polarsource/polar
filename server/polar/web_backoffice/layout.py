import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request

from .components import layout as layout_component
from .navigation import NAVIGATION


@contextlib.contextmanager
def layout(
    request: Request, breadcrumbs: Sequence[tuple[str, str]], active_route_name: str
) -> Generator[None]:
    """Create the complete backoffice layout with sidebar and main content.

    Generates the full page layout including sidebar navigation, main content area,
    and responsive behavior. The layout supports both full page loads and HTMX
    partial updates. For HTMX boosted requests targeting the content area, only
    the content, title, and menu are updated. Otherwise, the complete layout
    with sidebar is rendered.

    The layout includes:
    - Responsive drawer-based sidebar for mobile
    - Fixed sidebar for desktop (lg+ breakpoints)
    - Mobile hamburger menu toggle
    - Polar logo in sidebar
    - Breadcrumb navigation in main content
    - HTMX boost integration for SPA-like navigation

    Args:
        request: The FastAPI request object used for URL generation and
            detecting HTMX requests.
        breadcrumbs: Sequence of (title, href) tuples for breadcrumb navigation.
            Note that you should provide them in reverse order, with the
            current page first.
        active_route_name: The name of the currently active route for menu
            highlighting.

    Example:
        >>> breadcrumbs = [("Dashboard", "/dashboard")]
        >>> with layout(request, breadcrumbs, "dashboard"):
        ...     with tag.h1():
        ...         text("Dashboard Content")
    """
    with layout_component(
        request,
        breadcrumbs=breadcrumbs,
        navigation=NAVIGATION,
        active_route_name=active_route_name,
    ):
        yield
