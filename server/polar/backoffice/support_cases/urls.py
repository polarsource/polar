"""URL helpers for support-case pages, shared by the endpoints and the thread
renderer. Kept import-light (no models/endpoints) to avoid an import cycle."""

from urllib.parse import urlencode
from uuid import UUID

from fastapi import Request


def is_safe_return_to(return_to: str | None) -> bool:
    """Same-site relative path only, to avoid an open redirect."""
    return bool(
        return_to and return_to.startswith("/") and not return_to.startswith("//")
    )


def append_return_to(url: str, return_to: str | None) -> str:
    """Append a validated ``return_to`` query arg to a URL; a no-op otherwise."""
    if not is_safe_return_to(return_to):
        return url
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}{urlencode({'return_to': return_to})}"


def case_detail_url(
    request: Request, case_id: UUID, *, return_to: str | None = None
) -> str:
    """The case detail page, carrying a validated ``return_to`` so the back link
    and post-action redirects come back to wherever the staff member started."""
    url = str(request.url_for("support_cases:detail", case_id=case_id))
    return append_return_to(url, return_to)


__all__ = ["append_return_to", "case_detail_url", "is_safe_return_to"]
