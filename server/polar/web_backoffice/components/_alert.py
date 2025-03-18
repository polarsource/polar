import contextlib
from collections.abc import Generator
from typing import Any

from sqlalchemy.util.typing import Literal
from tagflow import classes, tag

Variant = Literal["info", "success", "warning", "error"]


@contextlib.contextmanager
def alert(
    variant: Variant | None = None,
    dash: bool = False,
    soft: bool = False,
    **kwargs: Any,
) -> Generator[None]:
    variants = {
        "info": "alert-info",
        "success": "alert-success",
        "warning": "alert-warning",
        "error": "alert-error",
    }
    with tag.div(classes="alert", role="alert", **kwargs):
        if variant:
            classes(variants[variant])
        if dash:
            classes("alert-dash")
        if soft:
            classes("alert-soft")
        yield


__all__ = ["Variant"]
