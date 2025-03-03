import contextlib
from collections.abc import Generator
from typing import Literal

from tagflow import tag

Variant = Literal[
    "neutral", "primary", "secondary", "accent", "info", "success", "warning", "error"
]
Size = Literal["xs", "sm", "md", "lg", "xl"]


@contextlib.contextmanager
def clipboard_button(text: str) -> Generator[None]:
    with tag.button(
        type="button",
        classes="font-normal cursor-pointer",
        _=f"""
        on click call navigator.clipboard.writeText('{text}')
        then add @disabled to me
        then toggle .hidden on <div /> in me
        then wait 5s
        then toggle .hidden on <div /> in me
        then remove @disabled from me
        """,
    ):
        with tag.div(classes="icon-clipboard"):
            pass
        with tag.div(classes="icon-clipboard-check hidden"):
            pass
    yield


__all__ = ["clipboard_button"]
