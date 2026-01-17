import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request

from polar.backoffice.document import get_document

from ._base import base, title
from ._navigation import NavigationItem


@contextlib.contextmanager
def content(
    request: Request,
    breadcrumbs: Sequence[tuple[str, str]],
) -> Generator[None]:
    doc = get_document()
    with doc.div(classes="breadcrumbs text-sm"):
        with doc.ul():
            for title, href in reversed(
                [
                    *breadcrumbs,
                    (
                        "Polar Backoffice",
                        str(request.url_for("index")),
                    ),
                ]
            ):
                with doc.li():
                    with doc.a(href=href):
                        doc.text(title)
        yield


@contextlib.contextmanager
def menu(
    request: Request,
    navigation: list[NavigationItem],
    active_route_name: str,
) -> Generator[None]:
    doc = get_document()
    with doc.ul(classes="menu w-full", id="menu", hx_swap_oob="true"):
        for item in navigation:
            with item.render(request, active_route_name):
                pass
    yield


@contextlib.contextmanager
def layout(
    request: Request,
    breadcrumbs: Sequence[tuple[str, str]],
    navigation: list[NavigationItem],
    active_route_name: str,
) -> Generator[None]:
    title_parts = [title for title, href in breadcrumbs]
    if (
        request.headers.get("HX-Boosted")
        and request.headers.get("HX-Target") == "content"
    ):
        with content(request, breadcrumbs):
            yield
        with title(title_parts):
            pass
        with menu(request, navigation, active_route_name):
            pass
        return

    with base(request, title_parts):
        with doc.div(classes="drawer lg:drawer-open"):
            with doc.input(id="menu-toggle", type="checkbox", classes="drawer-toggle"):
                pass
            with doc.main(classes="drawer-content"):
                with doc.div(classes="flex flex-row items-center"):
                    with doc.label(
                        classes="btn btn-ghost drawer-button lg:hidden",
                        **{"for": "menu-toggle"},
                    ):
                        with doc.div(classes="icon-menu"):
                            pass
                with doc.div(classes="flex flex-col gap-4 p-4"):
                    with doc.div(
                        id="content",
                        classes="h-full w-full",
                        hx_boost="true",
                        hx_target="#content",
                    ):
                        with content(request, breadcrumbs):
                            yield
            with doc.aside(classes="drawer-side"):
                with doc.label(
                    classes="drawer-overlay",
                    **{"for": "menu-toggle"},
                ):
                    pass

                with doc.div(
                    classes="bg-base-200 text-base-content min-h-full w-60 p-4 flex flex-col gap-4"
                ):
                    with doc.a(
                        href=str(request.url_for("index")),
                        classes="flex justify-center",
                    ):
                        with doc.img(
                            src=str(request.url_for("static", path="logo.light.svg")),
                            classes="h-8 dark:hidden",
                        ):
                            pass
                        with doc.img(
                            src=str(request.url_for("static", path="logo.dark.svg")),
                            classes="h-8 dark:block hidden",
                        ):
                            pass
                    with menu(request, navigation, active_route_name):
                        pass


__all__ = ["layout"]
