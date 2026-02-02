"""Jinja2 template configuration for the backoffice."""

from pathlib import Path

from fastapi.templating import Jinja2Templates

# Get the templates directory path
TEMPLATES_DIR = Path(__file__).parent / "templates"

# Configure Jinja2 templates
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def is_htmx_request(request) -> bool:
    """Check if the request is an HTMX request."""
    return request.headers.get("HX-Request") == "true"


def is_htmx_boosted(request) -> bool:
    """Check if the request is an HTMX boosted request."""
    return request.headers.get("HX-Boosted") == "true"


def get_htmx_target(request) -> str | None:
    """Get the HTMX target from the request."""
    return request.headers.get("HX-Target")


# Add custom globals and filters to Jinja2 environment
templates.env.globals["is_htmx_request"] = is_htmx_request
templates.env.globals["is_htmx_boosted"] = is_htmx_boosted
templates.env.globals["get_htmx_target"] = get_htmx_target


__all__ = ["templates"]
