import contextlib
from collections.abc import Generator
from typing import Any

from markupflow import Fragment
from sqlalchemy.util.typing import Literal

Variant = Literal["info", "success", "warning", "error"]


@contextlib.contextmanager
def alert(
    variant: Variant | None = None,
    dash: bool = False,
    soft: bool = False,
    *,
    classes: str | None = None,
    **kwargs: Any,
) -> Generator[Fragment]:
    """Create a styled alert component using DaisyUI classes.

    Generates an alert div with configurable styling variants and modifiers.
    The alert uses semantic role="alert" for accessibility and can be customized
    with different visual styles.

    Args:
        variant: The alert style variant. One of "info", "success", "warning", or "error".
            If None, uses the default alert styling.
        dash: If True, applies dash styling modifier (alert-dash class).
        soft: If True, applies soft styling modifier (alert-soft class).
        **kwargs: Additional HTML attributes to pass to the alert div element.

    Example:
        >>> with alert(variant="success", soft=True) as alert_frag:
        ...     alert_frag.text("Operation completed successfully!")
    """
    variants = {
        "info": "alert-info",
        "success": "alert-success",
        "warning": "alert-warning",
        "error": "alert-error",
    }
    fragment = Fragment()
    with fragment.div(class_="alert", role="alert", **kwargs):
        if variant:
            fragment.classes(variants[variant])
        if dash:
            fragment.classes("alert-dash")
        if soft:
            fragment.classes("alert-soft")
        if classes:
            fragment.classes(classes)
        yield fragment


__all__ = ["Variant"]
