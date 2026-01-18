import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request
from markupflow import Fragment

from ._base import base, title
from ._navigation import NavigationItem


@contextlib.contextmanager
def content(
    request: Request,
    breadcrumbs: Sequence[tuple[str, str]],
) -> Generator[Fragment]:
    fragment = Fragment()
    with fragment.div(class_="breadcrumbs text-sm"):
        with fragment.ul():
            for title_text, href in reversed(
                [
                    *breadcrumbs,
                    (
                        "Polar Backoffice",
                        str(request.url_for("index")),
                    ),
                ]
            ):
                with fragment.li():
                    with fragment.a(href=href):
                        fragment.text(title_text)
        yield fragment


@contextlib.contextmanager
def menu(
    request: Request,
    navigation: list[NavigationItem],
    active_route_name: str,
) -> Generator[Fragment]:
    fragment = Fragment()
    with fragment.ul(class_="menu w-full", id="menu", hx_swap_oob="true"):
        for item in navigation:
            with item.render(request, active_route_name):
                pass
    yield fragment


@contextlib.contextmanager
def layout(
    request: Request,
    breadcrumbs: Sequence[tuple[str, str]],
    navigation: list[NavigationItem],
    active_route_name: str,
) -> Generator[Fragment]:
    title_parts = [title_text for title_text, href in breadcrumbs]
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
        fragment = Fragment()
        with fragment.div(class_="drawer lg:drawer-open"):
            with fragment.input(
                id="menu-toggle", type="checkbox", class_="drawer-toggle"
            ):
                pass
            with fragment.main(class_="drawer-content"):
                with fragment.div(class_="flex flex-row items-center"):
                    with fragment.label(
                        class_="btn btn-ghost drawer-button lg:hidden",
                        **{"for": "menu-toggle"},
                    ):
                        with fragment.div(class_="icon-menu"):
                            pass
                with fragment.div(class_="flex flex-col gap-4 p-4"):
                    with fragment.div(
                        id="content",
                        class_="h-full w-full",
                        hx_boost="true",
                        hx_target="#content",
                    ):
                        with content(request, breadcrumbs):
                            yield fragment
            with fragment.aside(class_="drawer-side"):
                with fragment.label(
                    class_="drawer-overlay",
                    **{"for": "menu-toggle"},
                ):
                    pass

                with fragment.div(
                    class_="bg-base-200 text-base-content min-h-full w-60 p-4 flex flex-col gap-4"
                ):
                    with fragment.a(
                        href=str(request.url_for("index")),
                        class_="flex justify-center",
                    ):
                        with fragment.img(
                            src=str(request.url_for("static", path="logo.light.svg")),
                            class_="h-8 dark:hidden",
                        ):
                            pass
                        with fragment.img(
                            src=str(request.url_for("static", path="logo.dark.svg")),
                            class_="h-8 dark:block hidden",
                        ):
                            pass
                    with menu(request, navigation, active_route_name):
                        pass


__all__ = ["layout"]
