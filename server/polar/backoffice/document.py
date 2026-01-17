"""Document context management for markupflow."""

from __future__ import annotations

from fastapi import Request
from markupflow import Document


def get_document(request: Request) -> Document:
    """Get the document from request scope.

    Args:
        request: The FastAPI request object.

    Returns:
        The Document instance for the current request.

    Raises:
        RuntimeError: If no document is found in request scope.
    """
    doc = request.scope.get("markupflow_document")
    if doc is None:
        raise RuntimeError("No document in request scope")
    return doc


__all__ = ["Document", "get_document"]
