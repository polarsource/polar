import contextlib
import dataclasses
from collections.abc import Generator
from typing import Literal

from fastapi import Request
from starlette.types import Scope

from .components import alert
from polar.backoffice.document import get_document

Variant = Literal["info", "success", "warning", "error"]


@dataclasses.dataclass
class Toast:
    message: str
    variant: Variant


@contextlib.contextmanager
def render_toasts(scope: Scope) -> Generator[None]:
    doc = scope.get("markupflow_document")
    if doc is None:
        raise RuntimeError("No document in request scope")

    toasts: list[Toast] = scope.get("toasts", [])
    with doc.div(
        id="toast", classes="toast toast-bottom toast-end", hx_swap_oob="beforeend"
    ):
        for toast in toasts:
            with alert(
                toast.variant,
                _="""
                init
                    wait 5s
                    remove me
                end
                on click remove me
                """,
            ):
                doc.text(toast.message)
    yield


async def add_toast(request: Request, message: str, variant: Variant = "info") -> None:

    doc = get_document()    toasts: list[Toast] = request.scope.get("toasts", [])
    toasts.append(Toast(message, variant))
    request.scope["toasts"] = toasts


__all__ = ["add_toast", "render_toasts"]
