import contextlib
from collections.abc import Generator

from tagflow import tag


@contextlib.contextmanager
def search(name: str | None = None, value: str | None = None) -> Generator[None]:
    with tag.label(classes="input"):
        with tag.div(classes="icon-search opacity-50"):
            pass
        with tag.input(type="search", classes="grow", name=name, value=value):
            pass
    yield


__all__ = ["search"]
