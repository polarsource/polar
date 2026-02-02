"""Jinja2 template configuration for the backoffice."""

from collections.abc import Sequence
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import Request
from fastapi.templating import Jinja2Templates
from starlette.responses import Response

if TYPE_CHECKING:
    from .components._navigation import NavigationItem

# Get the templates directory path
TEMPLATES_DIR = Path(__file__).parent / "templates"

# Configure Jinja2 templates
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def is_htmx_request(request: Request) -> bool:
    """Check if the request is an HTMX request."""
    return request.headers.get("HX-Request") == "true"


def is_htmx_boosted(request: Request) -> bool:
    """Check if the request is an HTMX boosted request."""
    return request.headers.get("HX-Boosted") == "true"


def get_htmx_target(request: Request) -> str | None:
    """Get the HTMX target from the request."""
    return request.headers.get("HX-Target")


# Add custom globals and filters to Jinja2 environment
templates.env.globals["is_htmx_request"] = is_htmx_request
templates.env.globals["is_htmx_boosted"] = is_htmx_boosted
templates.env.globals["get_htmx_target"] = get_htmx_target


def render_page(
    request: Request,
    template_name: str,
    *,
    breadcrumbs: Sequence[tuple[str, str]] | None = None,
    navigation: Sequence[object],  # List of NavigationItem instances
    active_route_name: str,
    **context: object,
) -> Response:
    """Render a backoffice page template with common context.

    This utility function provides a standardized way to render backoffice pages
    with proper typing and automatic inclusion of common context variables like
    navigation, breadcrumbs, and titles.

    Args:
        request: The FastAPI request object.
        template_name: Name of the template to render (e.g., "pages/index.html").
        breadcrumbs: Optional sequence of (title, href) tuples for breadcrumb navigation.
            The breadcrumbs should be in display order (not reversed).
            "Polar Backoffice" is automatically prepended.
        navigation: List of NavigationItem instances for the sidebar menu.
        active_route_name: The name of the currently active route for menu highlighting.
        **context: Additional context variables to pass to the template.

    Returns:
        A TemplateResponse ready to be returned from an endpoint.

    Example:
        >>> return render_page(
        ...     request,
        ...     "pages/dashboard.html",
        ...     breadcrumbs=[("Dashboard", "/dashboard")],
        ...     navigation=NAVIGATION,
        ...     active_route_name="dashboard",
        ...     custom_data="some value",
        ... )
    """
    breadcrumbs_list = list(breadcrumbs) if breadcrumbs else []
    title_parts = [title for title, _ in breadcrumbs_list]

    return templates.TemplateResponse(
        request=request,
        name=template_name,
        context={
            "breadcrumbs": breadcrumbs_list,
            "title_parts": title_parts,
            "navigation": navigation,
            "active_route_name": active_route_name,
            **context,
        },
    )


__all__ = ["templates", "render_page"]
