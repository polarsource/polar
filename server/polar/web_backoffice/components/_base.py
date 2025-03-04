import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request
from tagflow import tag, text


@contextlib.contextmanager
def base(request: Request, title_parts: Sequence[str]) -> Generator[None]:
    with tag.html(lang="en"):
        with tag.head():
            with tag.meta(charset="utf-8"):
                pass
            with tag.meta(
                name="viewport", content="width=device-width, initial-scale=1.0"
            ):
                pass
            with tag.link(
                href=str(request.url_for("static", path="styles.css")),
                rel="stylesheet",
                type="text/css",
            ):
                pass
            with tag.script(src=str(request.url_for("static", path="scripts.js"))):
                pass
            with tag.title():
                text(
                    " · ".join((*title_parts, "Polar Backoffice")),
                )

        with tag.body():
            yield


__all__ = ["base"]
