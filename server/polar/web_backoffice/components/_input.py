import contextlib
from collections.abc import Generator, Sequence

from tagflow import classes as _classes
from tagflow import tag, text
from tagflow.tagflow import AttrValue


@contextlib.contextmanager
def search(
    name: str | None = None, value: str | None = None, placeholder: str | None = None
) -> Generator[None]:
    with tag.label(classes="input"):
        with tag.div(classes="icon-search opacity-50"):
            pass
        with tag.input(
            type="search",
            classes="grow",
            name=name,
            value=value,
            placeholder=placeholder,
        ):
            pass
    yield


@contextlib.contextmanager
def select(
    options: Sequence[tuple[str, str]],
    value: str | None = None,
    *,
    placeholder: str | None = None,
    classes: str | None = None,
    **kwargs: AttrValue,
) -> Generator[None]:
    with tag.select(classes="select", **kwargs):
        if classes is not None:
            _classes(classes)
        if placeholder is not None:
            with tag.option(value="", selected=not value):
                text(placeholder)
        for option_label, option_value in options:
            with tag.option(value=option_value, selected=option_value == value):
                text(option_label)
    yield


__all__ = ["search"]
