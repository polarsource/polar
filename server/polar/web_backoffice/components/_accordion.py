import contextlib
from collections.abc import Generator

from tagflow import tag, text


@contextlib.contextmanager
def item(accordion_name: str, title: str) -> Generator[None]:
    with tag.div(classes="collapse collapse-arrow bg-base-100 border border-base-300"):
        with tag.input(type="radio", name=accordion_name):
            pass
        with tag.div(classes="collapse-title font-semibold"):
            text(title)
        with tag.div(classes="collapse-content"):
            yield


__all__ = ["item"]
