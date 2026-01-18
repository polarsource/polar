import contextlib
import dataclasses
from collections.abc import Generator
from typing import Literal

from fastapi import Request
from markupflow import Fragment
from starlette.types import Scope

from .components import alert

Variant = Literal["info", "success", "warning", "error"]


@dataclasses.dataclass
class Toast:
    message: str
    variant: Variant


@contextlib.contextmanager
def render_toasts(scope: Scope, fragment: Fragment) -> Generator[None]:
    """Render toasts into the provided fragment."""
    toasts: list[Toast] = scope.get("toasts", [])
    with fragment.div(
        id="toast", class_="toast toast-bottom toast-end", hx_swap_oob="beforeend"
    ):
        for toast in toasts:
            with fragment.fragment(alert(
                toast.variant,
                _="""
                init
                    wait 5s
                    remove me
                end
                on click remove me
                """,
            )) as alert_frag:
                alert_frag.text(toast.message)
    yield


async def add_toast(request: Request, message: str, variant: Variant = "info") -> None:
    toasts: list[Toast] = request.scope.get("toasts", [])
    toasts.append(Toast(message, variant))
    request.scope["toasts"] = toasts


__all__ = ["add_toast", "render_toasts"]
