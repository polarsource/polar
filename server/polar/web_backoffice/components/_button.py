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
    with tag.button(classes="btn", **kwargs):
        if variant:
            classes(f"btn-{variant}")
        if size:
            classes(f"btn-{size}")
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
