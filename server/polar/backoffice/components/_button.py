import contextlib
from collections.abc import Generator
from typing import Literal

from markupflow import AttrValue, Fragment

Variant = Literal[
    "neutral", "primary", "secondary", "accent", "info", "success", "warning", "error"
]
Size = Literal["xs", "sm", "md", "lg", "xl"]


@contextlib.contextmanager
def button(
    *,
    variant: Variant | None = None,
    size: Size | None = None,
    ghost: bool = False,
    link: bool = False,
    soft: bool = False,
    outline: bool = False,
    **kwargs: AttrValue,
) -> Generator[Fragment]:
    """Create a styled button component using DaisyUI classes.

    Generates a button element with configurable styling variants, sizes, and modifiers.
    All parameters are keyword-only to encourage explicit usage and prevent confusion
    with positional arguments.

    Args:
        variant: The button color variant. One of "neutral", "primary", "secondary",
            "accent", "info", "success", "warning", or "error". If None, uses default styling.
        size: The button size. One of "xs", "sm", "md", "lg", or "xl". If None, uses default size.
        ghost: If True, applies ghost styling (transparent background with colored text/border).
        link: If True, styles the button to look like a link (no background, underlined on hover).
        soft: If True, applies soft styling modifier (btn-soft class).
        outline: If True, applies outline styling (transparent background with colored border).
        **kwargs: Additional HTML attributes to pass to the button element (e.g., type, onclick, etc.).

    Yields:
        Fragment: The fragment for adding button content.

    Example:
        >>> with button(variant="primary", size="lg", outline=True, type="submit") as btn:
        ...     btn.text("Submit Form")
    """
    variants = {
        "neutral": "btn-neutral",
        "primary": "btn-primary",
        "secondary": "btn-secondary",
        "accent": "btn-accent",
        "info": "btn-info",
        "success": "btn-success",
        "warning": "btn-warning",
        "error": "btn-error",
    }
    sizes = {
        "xs": "btn-xs",
        "sm": "btn-sm",
        "md": "btn-md",
        "lg": "btn-lg",
        "xl": "btn-xl",
    }
    fragment = Fragment()
    with fragment.button(class_="btn", **kwargs):
        if variant:
            fragment.classes(variants[variant])
        if size:
            fragment.classes(sizes[size])
        if ghost:
            fragment.classes("btn-ghost")
        if link:
            fragment.classes("btn-link")
        if soft:
            fragment.classes("btn-soft")
        if outline:
            fragment.classes("btn-outline")
        yield fragment


__all__ = ["button"]
