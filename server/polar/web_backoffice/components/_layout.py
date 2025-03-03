import contextlib
from collections.abc import Generator, Sequence

from fastapi import Request
from tagflow import tag

from ._base import base
from ._navigation import NavigationItem


@contextlib.contextmanager
def layout(
    request: Request,
    title_parts: Sequence[str],
    navigation: list[NavigationItem],
    active_route_name: str,
) -> Generator[None]:
    with base(title_parts):
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
                    with tag.div(classes="h-full w-full"):
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
                    with tag.ul(classes="menu w-full"):
                        for item in navigation:
                            with item.render(request, active_route_name):
                                pass


__all__ = ["layout"]
