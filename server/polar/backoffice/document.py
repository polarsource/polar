"""Document context management for markupflow."""

from __future__ import annotations

from contextvars import ContextVar

from fastapi import Request
from markupflow import Document

# ContextVar to store current document
_current_doc: ContextVar[Document | None] = ContextVar("current_doc", default=None)


def set_document(doc: Document) -> None:
    """Set the current document in context."""
    _current_doc.set(doc)


def get_document(request: Request | None = None) -> Document:
    """FastAPI dependency to get the document from request scope.

    Can be used as a FastAPI dependency or called directly in context managers.

    Args:
        request: The FastAPI request object (when used as dependency).

    Returns:
        The Document instance for the current request.

    Raises:
        RuntimeError: If no document is found.
    """
    if request is not None:
        doc = request.scope.get("markupflow_document")
        if doc is not None:
            return doc

    # Try to get from contextvar
    doc = _current_doc.get()
    if doc is not None:
        return doc

    raise RuntimeError("No document in context")


__all__ = ["Document", "get_document", "set_document"]
