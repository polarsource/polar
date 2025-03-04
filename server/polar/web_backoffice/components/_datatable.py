import contextlib
from collections.abc import Generator, Sequence
from enum import Enum, auto
from inspect import isgenerator
from typing import Generic, TypeVar

from fastapi import Request
from fastapi.datastructures import URL
from tagflow import attr, classes, tag, text

from polar.kit.pagination import PaginationParams
from polar.kit.sorting import PE, Sorting

from .. import formatters
from ._button import button
from ._clipboard_button import clipboard_button

M = TypeVar("M")


class DatatableColumn(Generic[M]):
    label: str

    def __init__(self, label: str) -> None:
        self.label = label

    def render(self, request: Request, item: M) -> Generator[None] | None:
        raise NotImplementedError()

    @contextlib.contextmanager
    def _do_render(self, request: Request, item: M) -> Generator[None]:
        value = self.render(request, item)
        if isgenerator(value):
            yield from value
        else:
            yield


class DatatableAttrColumn(Generic[M, PE], DatatableColumn[M]):
    attr: str
    sorting: PE | None
    href_route_name: str | None
    clipboard: bool

    def __init__(
        self,
        attr: str,
        label: str | None = None,
        *,
        sorting: PE | None = None,
        href_route_name: str | None = None,
        clipboard: bool = False,
    ) -> None:
        self.attr = attr
        self.sorting = sorting
        self.href_route_name = href_route_name
        self.clipboard = clipboard
        super().__init__(label or attr)

    def render(self, request: Request, item: M) -> Generator[None] | None:
        value = self.get_value(item)
        href = (
            request.url_for(self.href_route_name, id=getattr(item, "id"))
            if self.href_route_name
            else None
        )
        with tag.div(classes="flex items-center gap-1"):
            value_tag = tag.a if href else tag.div
            with value_tag():
                if href:
                    classes("link")
                    attr("href", str(href))
                text(value)
            if self.clipboard:
                with clipboard_button(value):
                    pass
        return None

    def get_value(self, item: M) -> str:
        return str(getattr(item, self.attr))


class DatatableDateTimeColumn(Generic[M, PE], DatatableAttrColumn[M, PE]):
    def get_value(self, item: M) -> str:
        value = getattr(item, self.attr)
        return formatters.datetime(value)


class DatatableActionsColumn(Generic[M], DatatableColumn[M]):
    def __init__(self, label: str, *actions: tuple[str, str | URL]) -> None:
        self.actions = actions
        super().__init__(label)

    def render(self, request: Request, item: M) -> Generator[None] | None:
        item_id = getattr(item, "id")
        with button(
            size="sm",
            ghost=True,
            type="button",
            popovertarget=f"popover-{item_id}",
            style=f"anchor-name:--anchor-{item_id}",
        ):
            with tag.div(classes="font-normal icon-ellipsis-vertical"):
                pass
        with tag.ul(
            classes="dropdown menu rounded-box bg-base-200 w-48 shadow-sm",
            popover="true",
            id=f"popover-{item_id}",
            style=f"position-anchor:--anchor-{item_id}",
        ):
            for label, url in self.actions:
                with tag.li():
                    with tag.a(href=str(url)):
                        text(label)
        return None


class SortWay(Enum):
    ASC = auto()
    DESC = auto()


class Datatable(Generic[M, PE]):
    def __init__(self, *columns: DatatableColumn[M]) -> None:
        self.columns = columns

    @contextlib.contextmanager
    def render(
        self,
        request: Request,
        items: Sequence[M],
        *,
        sorting: list[Sorting[PE]] | None = None,
    ) -> Generator[None]:
        with tag.div(
            classes="overflow-x-auto rounded-box bg-base-100 border-1 border-gray-600"
        ):
            with tag.table(classes="table table-auto"):
                with tag.thead():
                    with tag.tr():
                        for column in self.columns:
                            with tag.th():
                                if (
                                    not isinstance(column, DatatableAttrColumn)
                                    or column.sorting is None
                                ):
                                    text(column.label)
                                    continue

                                with tag.a(
                                    href=str(
                                        self._get_column_sort_url(
                                            request, sorting, column
                                        )
                                    ),
                                    classes="flex gap-1",
                                ):
                                    text(column.label)
                                    column_sort = self._get_column_sort(sorting, column)
                                    with tag.div("font-normal"):
                                        if column_sort == SortWay.ASC:
                                            classes("icon-arrow-down-a-z")
                                        elif column_sort == SortWay.DESC:
                                            classes("icon-arrow-up-z-a")

                with tag.tbody():
                    for item in items:
                        with tag.tr():
                            for column in self.columns:
                                with tag.td():
                                    with column._do_render(request, item):
                                        pass

        yield

    def _get_column_sort(
        self, sorting: list[Sorting[PE]] | None, column: DatatableAttrColumn[M, PE]
    ) -> SortWay | None:
        if sorting is None or column.sorting is None:
            return None

        for field, is_desc in sorting:
            if field == column.sorting:
                return SortWay.DESC if is_desc else SortWay.ASC

        return None

    def _get_column_sort_url(
        self,
        request: Request,
        sorting: list[Sorting[PE]] | None,
        column: DatatableAttrColumn[M, PE],
    ) -> URL:
        url = request.url.remove_query_params("sorting")

        for field, is_desc in sorting or []:
            if field == column.sorting:
                if not is_desc:
                    url = url.include_query_params(sorting=f"-{field.value}")
                break
        else:
            if column.sorting is not None:
                url = url.include_query_params(sorting=column.sorting.value)

        return url


@contextlib.contextmanager
def pagination(
    request: Request, pagination: PaginationParams, count: int
) -> Generator[None]:
    start = (pagination.page - 1) * pagination.limit + 1
    end = min(pagination.page * pagination.limit, count)

    next_url: URL | None = None
    if end < count:
        next_url = request.url.replace_query_params(
            **{**request.query_params, "page": pagination.page + 1}
        )
    previous_url: URL | None = None
    if start > 1:
        previous_url = request.url.replace_query_params(
            **{**request.query_params, "page": pagination.page - 1}
        )

    with tag.div(classes="flex justify-between"):
        with tag.div(classes="text-sm"):
            text("Showing ")
            with tag.span(classes="font-bold"):
                text(str(start))
            text(" to ")
            with tag.span(classes="font-bold"):
                text(str(end))
            text(" of ")
            with tag.span(classes="font-bold"):
                text(str(count))
            text(" entries")
        with tag.div(classes="join grid grid-cols-2"):
            with tag.a(
                classes="join-item btn",
                href=str(previous_url) if previous_url else "",
            ):
                if previous_url is None:
                    attr("disabled", True)
                text("Previous")
            with tag.a(
                classes="join-item btn",
                href=str(next_url) if next_url else "",
            ):
                if next_url is None:
                    attr("disabled", True)
                text("Next")
    yield


__all__ = [
    "pagination",
    "Datatable",
    "DatatableColumn",
    "DatatableAttrColumn",
    "DatatableDateTimeColumn",
    "DatatableActionsColumn",
]
