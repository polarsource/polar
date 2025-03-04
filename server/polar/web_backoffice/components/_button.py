import contextlib
from collections.abc import Generator
from typing import Literal

from tagflow import classes, tag
from tagflow.tagflow import AttrValue

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
) -> Generator[None]:
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
    with tag.button(classes="btn", **kwargs):
        if variant:
            classes(variants[variant])
        if size:
            classes(sizes[size])
        if ghost:
            classes("btn-ghost")
        if link:
            classes("btn-link")
        if soft:
            classes("btn-soft")
        if outline:
            classes("btn-outline")
        yield


__all__ = ["button"]
