import contextlib
from collections.abc import Generator
from typing import Any

from sqlalchemy.util.typing import Literal
from tagflow import classes as _classes
from tagflow import tag

Variant = Literal["info", "success", "warning", "error"]


@contextlib.contextmanager
def alert(
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
        variant: The alert style variant. One of "info", "success", "warning", or "error".
            If None, uses the default alert styling.
        dash: If True, applies dash styling modifier (alert-dash class).
        soft: If True, applies soft styling modifier (alert-soft class).
        **kwargs: Additional HTML attributes to pass to the alert div element.

    Example:
        >>> with alert(variant="success", soft=True):
        ...     text("Operation completed successfully!")
    """
    variants = {
        "info": "alert-info",
        "success": "alert-success",
        "warning": "alert-warning",
        "error": "alert-error",
    }
    with tag.div(classes="alert", role="alert", **kwargs):
        if variant:
            _classes(variants[variant])
        if dash:
            _classes("alert-dash")
        if soft:
            _classes("alert-soft")
        if classes:
            _classes(classes)
        yield


__all__ = ["Variant"]
