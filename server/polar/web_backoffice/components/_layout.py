import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request
from tagflow import tag, text

from ._base import base, title
from ._navigation import NavigationItem


@contextlib.contextmanager
def content(
    request: Request,
    breadcrumbs: Sequence[tuple[str, str]],
) -> Generator[None]:
    with tag.div(classes="breadcrumbs text-sm"):
        with tag.ul():
            for title, href in reversed(
                [
                    *breadcrumbs,
                    (
                        "Polar Backoffice",
                        str(request.url_for("index")),
                    ),
                ]
            ):
                with tag.li():
                    with tag.a(href=href):
                        text(title)
        yield


@contextlib.contextmanager
def menu(
    request: Request,
    navigation: list[NavigationItem],
    active_route_name: str,
) -> Generator[None]:
    with tag.ul(classes="menu w-full", id="menu", hx_swap_oob="true"):
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
        with tag.div(classes="drawer lg:drawer-open"):
            with tag.input(id="menu-toggle", type="checkbox", classes="drawer-toggle"):
                pass
            with tag.main(classes="drawer-content"):
                with tag.div(classes="flex flex-row items-center"):
                    with tag.label(
                        classes="btn btn-ghost drawer-button lg:hidden",
                        **{"for": "menu-toggle"},
                    ):
                        with tag.div(classes="icon-menu"):
                            pass
                with tag.div(classes="flex flex-col gap-4 p-4"):
                    with tag.div(
                        id="content",
                        classes="h-full w-full",
                        hx_boost="true",
                        hx_target="#content",
                    ):
                        with content(request, breadcrumbs):
                            yield
            with tag.aside(classes="drawer-side"):
                with tag.label(
                    classes="drawer-overlay",
                    **{"for": "menu-toggle"},
                ):
                    pass

                with tag.div(
                    classes="bg-base-200 text-base-content min-h-full w-60 p-4 flex flex-col gap-4"
                ):
                    with tag.a(
                        href=str(request.url_for("index")),
                        classes="flex justify-center",
                    ):
                        with tag.img(
                            src=str(request.url_for("static", path="logo.light.svg")),
                            classes="h-8 dark:hidden",
                        ):
                            pass
                        with tag.img(
                            src=str(request.url_for("static", path="logo.dark.svg")),
                            classes="h-8 dark:block hidden",
                        ):
                            pass
                    with menu(request, navigation, active_route_name):
                        pass


__all__ = ["layout"]
