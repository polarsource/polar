import contextlib
import typing
from collections.abc import Callable, Generator, Sequence
from datetime import datetime
from enum import Enum, auto
from inspect import isgenerator
from typing import Generic, Protocol, TypeVar

from fastapi import Request
from fastapi.datastructures import URL
from tagflow import attr, classes, tag, text

from polar.kit.pagination import PaginationParams
from polar.kit.sorting import PE, Sorting

from .. import formatters
from ._clipboard_button import clipboard_button

M = TypeVar("M", contravariant=True)


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
    clipboard: bool
    href_getter: Callable[[Request, M], str | None] | None
    external_href: bool

    @typing.overload
    def __init__(
        self,
        attr: str,
        label: str | None = None,
        *,
        clipboard: bool = False,
        href_route_name: str,
        sorting: PE | None = None,
    ) -> None: ...

    @typing.overload
    def __init__(
        self,
        attr: str,
        label: str | None = None,
        *,
        clipboard: bool = False,
        external_href: Callable[[Request, M], str | None],
        sorting: PE | None = None,
    ) -> None: ...

    @typing.overload
    def __init__(
        self,
        attr: str,
        label: str | None = None,
        *,
        sorting: PE | None = None,
        clipboard: bool = False,
    ) -> None: ...

    def __init__(
        self,
        attr: str,
        label: str | None = None,
        *,
        sorting: PE | None = None,
        clipboard: bool = False,
        href_route_name: str | None = None,
        external_href: Callable[[Request, M], str | None] | None = None,
    ) -> None:
        self.attr = attr
        self.sorting = sorting
        self.clipboard = clipboard

        self.href_getter = None
        self.external_href = False
        if external_href is not None:
            self.href_getter = external_href
            self.external_href = True
        elif href_route_name is not None:
            self.href_getter = lambda r, i: str(
                r.url_for(href_route_name, id=getattr(i, "id"))
            )

        super().__init__(label or attr)

    def render(self, request: Request, item: M) -> Generator[None] | None:
        value = self.get_value(item)
        href = self.href_getter(request, item) if self.href_getter else None
        with tag.div(classes="flex items-center gap-1"):
            value_tag = tag.a if href else tag.div
            with value_tag():
                if href:
                    classes("link")
                    attr("href", str(href))
                    if self.external_href:
                        attr("target", "_blank")
                        attr("rel", "noopener noreferrer")
                text(value if value is not None else "—")
            if value is not None and self.clipboard:
                with clipboard_button(value):
                    pass
        return None

    def get_value(self, item: M) -> str | None:
        value = getattr(item, self.attr)
        if value is None:
            return None
        return str(value)


class DatatableDateTimeColumn(Generic[M, PE], DatatableAttrColumn[M, PE]):
    def get_value(self, item: M) -> str | None:
        value: datetime | None = getattr(item, self.attr)
        if value is None:
            return None
        return formatters.datetime(value)


class DatatableAction(Protocol[M]):
    @contextlib.contextmanager
    def render(self, request: Request, item: M) -> Generator[None]: ...

    def is_hidden(self, request: Request, item: M) -> bool: ...


class DatatableActionLink(DatatableAction[M]):
    def __init__(
        self, label: str, href: str | URL | Callable[[Request, M], str]
    ) -> None:
        self.label = label
        self.href = href

    @contextlib.contextmanager
    def render(self, request: Request, item: M) -> Generator[None]:
        href: str
        if callable(self.href):
            href = self.href(request, item)
        else:
            href = str(self.href)
        with tag.a(href=href):
            text(self.label)
        yield

    def is_hidden(self, request: Request, item: M) -> bool:
        return False


class DatatableActionHTMX(DatatableAction[M]):
    def __init__(
        self,
        label: str,
        href: str | URL | Callable[[Request, M], str],
        target: str,
        hidden: Callable[[Request, M], bool] | None = None,
    ) -> None:
        self.label = label
        self.href = href
        self.target = target
        self.hidden = hidden

    @contextlib.contextmanager
    def render(self, request: Request, item: M) -> Generator[None]:
        href: str
        if callable(self.href):
            href = self.href(request, item)
        else:
            href = str(self.href)
        with tag.button(type="button", hx_get=str(href), hx_target=self.target):
            text(self.label)
        yield

    def is_hidden(self, request: Request, item: M) -> bool:
        if self.hidden is None:
            return False
        return self.hidden(request, item)


class DatatableActionsColumn(Generic[M], DatatableColumn[M]):
    def __init__(self, label: str, *actions: DatatableAction[M]) -> None:
        self.actions = actions
        super().__init__(label)

    def render(self, request: Request, item: M) -> Generator[None] | None:
        item_id = getattr(item, "id")
        with tag.details(classes="dropdown"):
            with tag.summary(type="button", classes="btn btn-ghost m-1"):
                with tag.div(classes="font-normal icon-ellipsis-vertical"):
                    pass

            displayed_actions = [
                action for action in self.actions if not action.is_hidden(request, item)
            ]
            if not displayed_actions:
                return None

            with tag.ul(
                classes="menu dropdown-content bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm",
            ):
                for action in displayed_actions:
                    with tag.li():
                        with action.render(request, item):
                            pass
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
