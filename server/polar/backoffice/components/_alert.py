import contextlib
from collections.abc import Generator
from typing import Any

from markupflow import Document
from sqlalchemy.util.typing import Literal

Variant = Literal["info", "success", "warning", "error"]


@contextlib.contextmanager
def alert(
    doc: Document,
    variant: Variant | None = None,
    dash: bool = False,
    soft: bool = False,
    *,
    classes: str | None = None,
    **kwargs: Any,
) -> Generator[None]:
    """Create a styled alert component using DaisyUI classes.

    Generates an alert div with configurable styling variants and modifiers.
    The alert uses semantic role="alert" for accessibility and can be customized
    with different visual styles.

    Args:
        doc: The markupflow Document instance.
        variant: The alert style variant. One of "info", "success", "warning", or "error".
            If None, uses the default alert styling.
        dash: If True, applies dash styling modifier (alert-dash class).
        soft: If True, applies soft styling modifier (alert-soft class).
        **kwargs: Additional HTML attributes to pass to the alert div element.

    Example:
        >>> with alert(doc, variant="success", soft=True):
        ...     doc.text("Operation completed successfully!")
    """
    variants = {
        "info": "alert-info",
        "success": "alert-success",
        "warning": "alert-warning",
        "error": "alert-error",
    }
    with doc.div(classes="alert", role="alert", **kwargs):
        if variant:
            doc.attr("class", variants[variant])
        if dash:
            doc.attr("class", "alert-dash")
        if soft:
            doc.attr("class", "alert-soft")
        if classes:
            doc.attr("class", classes)
        yield


__all__ = ["Variant"]
