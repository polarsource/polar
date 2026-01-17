import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request

from polar.backoffice.document import get_document

from ..static_urls import static_url


@contextlib.contextmanager
def title(title_parts: Sequence[str]) -> Generator[None]:
    doc = get_document(request)
    with doc.title(id="page_title", hx_swap_oob="true"):
        doc.text(
            " · ".join((*title_parts, "Polar Backoffice")),
        )
    yield


@contextlib.contextmanager
def base(request: Request, title_parts: Sequence[str]) -> Generator[None]:
    doc = get_document(request)
    with doc.html(lang="en"):
        with doc.head():
            with doc.meta(charset="utf-8"):
                pass
            with doc.meta(
                name="viewport", content="width=device-width, initial-scale=1.0"
            ):
                pass
            with doc.link(
                href=static_url(request, "styles.css"),
                rel="stylesheet",
                type="text/css",
            ):
                pass
            with doc.script(src=static_url(request, "scripts.js")):
                pass
            with title(title_parts):
                pass

            with doc.script(type="text/hyperscript"):
                doc.text("""
                on every htmx:beforeSend from <form />
                    for submitButton in <button[type='submit'] /> in it
                    toggle @disabled on submitButton until htmx:afterOnLoad
                    end
                end

                behavior CopyToClipboard(text)
                    on click call navigator.clipboard.writeText(text)
                    then add @disabled to me
                    then toggle .hidden on <div /> in me
                    then wait 5s
                    then toggle .hidden on <div /> in me
                    then remove @disabled from me
                end
                """)

        with doc.body():
            yield

            with doc.div(id="modal"):
                pass

            with doc.div(
                classes="absolute z-40 bottom-1 right-1 hidden",
                _="""
                on htmx:beforeSend from document
                  remove .hidden
                end
                on htmx:historyRestore from document
                  add .hidden
                end
                on htmx:afterOnLoad from document
                  add .hidden
                end
              """,
            ):
                with doc.span(classes="loading loading-spinner loading-sm"):
                    pass


__all__ = ["base", "title"]
