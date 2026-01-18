import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request
from markupflow import Fragment

from ..static_urls import static_url


@contextlib.contextmanager
def title(fragment: Fragment, title_parts: Sequence[str]) -> Generator[None]:
    with fragment.tag("title", id="page_title", hx_swap_oob="true"):
        fragment.text(
            " · ".join((*title_parts, "Polar Backoffice")),
        )
    yield


@contextlib.contextmanager
def base(request: Request, title_parts: Sequence[str]) -> Generator[Fragment]:
    fragment = Fragment()
    with fragment.tag("html", lang="en"):
        with fragment.tag("head"):
            with fragment.tag("meta", charset="utf-8"):
                pass
            with fragment.tag("meta",
                name="viewport", content="width=device-width, initial-scale=1.0"
            ):
                pass
            with fragment.tag("link",
                href=static_url(request, "styles.css"),
                rel="stylesheet",
                type="text/css",
            ):
                pass
            with fragment.tag("script", src=static_url(request, "scripts.js")):
                pass
            with title(fragment, title_parts):
                pass

            with fragment.tag("script", type="text/hyperscript"):
                fragment.text("""
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

        with fragment.tag("body"):
            yield fragment

            with fragment.div(id="modal"):
                pass

            with fragment.div(
                class_="absolute z-40 bottom-1 right-1 hidden",
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
                with fragment.span(class_="loading loading-spinner loading-sm"):
                    pass


__all__ = ["base", "title"]
