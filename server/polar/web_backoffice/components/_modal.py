import contextlib
from collections.abc import Generator

from tagflow import attr, tag, text


@contextlib.contextmanager
def modal(title: str, *, open: bool = False) -> Generator[None]:
    with tag.dialog(classes="modal modal-bottom sm:modal-middle"):
        if open:
            attr("open", True)
        with tag.div(classes="modal-box"):
            with tag.form(method="dialog"):
                with tag.button(
                    classes="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
                ):
                    with tag.div(classes="icon-x"):
                        pass
            with tag.h3(classes="text-lg font-bold mb-4"):
                text(title)
            yield
        with tag.form(method="dialog", classes="modal-backdrop"):
            with tag.button():
                pass


__all__ = ["modal"]
