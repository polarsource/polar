import contextlib
import random
import string
import typing
from collections.abc import Callable, Generator, Sequence
from datetime import datetime
from enum import Enum, StrEnum, auto
from inspect import isgenerator
from operator import attrgetter
from typing import Any, Protocol

from fastapi import Request
from fastapi.datastructures import URL
from tagflow import attr, classes, tag, text

from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting

from .. import formatters
from ._clipboard_button import clipboard_button


class DatatableColumn[M]:
    """Base class for datatable columns.

    Provides the foundation for all datatable column types. Subclasses must
    implement the render method to define how the column content is displayed.

    Args:
        M: Type parameter representing the model type that this column will display.
    """

    label: str

    def __init__(self, label: str) -> None:
        """
        Args:
            label: The text to display in the column header.
        """
        self.label = label

    def render(self, request: Request, item: M) -> Generator[None] | None:
        """Render the column content for a specific item.

        Args:
            request: The FastAPI request object.
            item: The data item to render in this column.
        """
        raise NotImplementedError()

    @contextlib.contextmanager
    def _do_render(self, request: Request, item: M) -> Generator[None]:
        value = self.render(request, item)
        if isgenerator(value):
            yield from value
        else:
            yield

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(label={self.label!r})"


class DatatableSortingColumn[M, PE: StrEnum](DatatableColumn[M]):
    """A datatable column that supports sorting functionality.

    Extends DatatableColumn to add sorting capabilities. This is detected by
    Datatable when generating sorting controls in the header.

    Args:
        M: Type parameter for the model type.
        PE: Type parameter for the sorting field enum.

    """

    sorting: PE | None

    def __init__(self, label: str, sorting: PE | None = None) -> None:
        """
        Args:
            label: The text to display in the column header.
            sorting: The sorting field identifier for this column.
        """
        self.sorting = sorting
        super().__init__(label)


class DatatableAttrColumn[M, PE: StrEnum](DatatableSortingColumn[M, PE]):
    """A datatable column that displays an attribute value from the model.

    This column extracts and displays a specific attribute from each model item.
    It supports optional clipboard functionality, linking to other pages, and
    custom value formatting through subclassing.

    Args:
        M: Type parameter for the model type.
        PE: Type parameter for the sorting field enum.
    """

    attr: str
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
    ) -> None:
        """
        Args:
            attr: The attribute name to extract from the model item (supports dot notation).
            label: The column header text. If None, uses the attribute name.
            clipboard: If True, adds a clipboard button to copy the cell value.
            href_route_name: Route name to generate internal links (uses item.id as parameter).
            sorting: The sorting field identifier for this column.
        """
        ...

    @typing.overload
    def __init__(
        self,
        attr: str,
        label: str | None = None,
        *,
        clipboard: bool = False,
        external_href: Callable[[Request, M], str | None],
        sorting: PE | None = None,
    ) -> None:
        """
        Args:
            attr: The attribute name to extract from the model item (supports dot notation).
            label: The column header text. If None, uses the attribute name.
            clipboard: If True, adds a clipboard button to copy the cell value.
            external_href: Function to generate external links from request and item.
            sorting: The sorting field identifier for this column.
        """
        ...

    @typing.overload
    def __init__(
        self,
        attr: str,
        label: str | None = None,
        *,
        sorting: PE | None = None,
        clipboard: bool = False,
    ) -> None:
        """
        Args:
            attr: The attribute name to extract from the model item (supports dot notation).
            label: The column header text. If None, uses the attribute name.
            sorting: The sorting field identifier for this column.
            clipboard: If True, adds a clipboard button to copy the cell value.
        """

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

        super().__init__(label or attr, sorting)

    def render(self, request: Request, item: M) -> Generator[None] | None:
        """Render the attribute value as a table cell.

        Args:
            request: The FastAPI request object.
            item: The model item to extract the attribute from.
        """
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

    def get_raw_value(self, item: M) -> Any:
        """Extract the raw attribute value from the model item.

        Args:
            item: The model item to extract from.

        Returns:
            The raw attribute value.

        Raises:
            AttributeError: If the attribute does not exist on the item.
        """
        return attrgetter(self.attr)(item)

    def get_value(self, item: M) -> str | None:
        """Get the formatted string value for display.

        This method can be overridden in subclasses to provide custom formatting.

        Args:
            item: The model item to extract from.

        Returns:
            The formatted string value, or None if the raw value is None.

        Raises:
            AttributeError: If the attribute does not exist on the item.
        """
        value = self.get_raw_value(item)
        if value is None:
            return None
        return str(value)

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(attr={self.attr!r}, label={self.label!r})"


class DatatableDateTimeColumn[M, PE: StrEnum](DatatableAttrColumn[M, PE]):
    """A datatable column that displays datetime attributes with proper formatting.

    Extends DatatableAttrColumn to format datetime values using the backoffice
    datetime formatter. Raw datetime objects are converted to user-friendly
    formatted strings.

    Args:
        M: Type parameter for the model type.
        PE: Type parameter for the sorting field enum.
    """

    def get_value(self, item: M) -> str | None:
        """Get the formatted datetime string for display.

        Args:
            item: The model item to extract the datetime from.

        Returns:
            A formatted datetime string, or None if the raw value is None.

        Raises:
            AttributeError: If the attribute does not exist on the item.
        """
        value: datetime | None = self.get_raw_value(item)
        if value is None:
            return None
        return formatters.datetime(value)


class DatatableCurrencyColumn[M, PE: StrEnum](DatatableAttrColumn[M, PE]):
    """A datatable column that displays currency values with proper formatting.

    Extends DatatableAttrColumn to format integer currency values (in cents)
    using the backoffice currency formatter. The currency type can be customized
    by overriding the get_currency method.

    Args:
        M: Type parameter for the model type.
        PE: Type parameter for the sorting field enum.
    """

    def get_value(self, item: M) -> str | None:
        """Get the formatted currency string for display.

        Args:
            item: The model item to extract the currency value from.

        Returns:
            A formatted currency string, or None if the raw value is None.
        """
        value: int | None = self.get_raw_value(item)
        if value is None:
            return None
        return formatters.currency(value, self.get_currency(item))

    def get_currency(self, item: M) -> str:
        """Get the currency code for formatting.

        By default, tries to extract the attribute 'currency' from the item,
        falling back to "usd" if not present. This can be overridden in subclasses
        to provide custom currency handling.

        Args:
            item: The data object (unused in base implementation).

        Returns:
            The currency code.
        """
        return getattr(item, "currency", "usd")


class DatatableBooleanColumn[M, PE: StrEnum](DatatableAttrColumn[M, PE]):
    """A datatable column that displays boolean attributes with icons.

    Extends DatatableAttrColumn to render boolean values as visual icons
    instead of text. True values show a check icon, False values show an X icon,
    and None values show a dash.

    Args:
        M: Type parameter for the model type.
        PE: Type parameter for the sorting field enum.
    """

    def render(self, request: Request, item: M) -> Generator[None] | None:
        """Render the boolean value as an icon.

        Args:
            request: The FastAPI request object.
            item: The model item to extract the boolean from.
        """
        value = self.get_raw_value(item)
        with tag.div():
            if value is None:
                text("—")
            elif value:
                with tag.div(classes="icon-check"):
                    pass
            else:
                with tag.div(classes="icon-x"):
                    pass

        return None


class DatatableAction[M](Protocol):
    """Protocol defining the interface for datatable row actions.

    Actions appear in action columns and provide interactive functionality
    for each row item. Implementations can be links, HTMX requests, or
    custom interactive elements.

    Args:
        M: Type parameter for the model type.
    """

    @contextlib.contextmanager
    def render(self, request: Request, item: M) -> Generator[None]:
        """Render the action element for a specific item.

        Args:
            request: The FastAPI request object.
            item: The model item this action applies to.
        """
        ...

    def is_hidden(self, request: Request, item: M) -> bool:
        """Determine if this action should be hidden for a specific item.

        Args:
            request: The FastAPI request object.
            item: The model item to check visibility for.

        Returns:
            True if the action should be hidden, False otherwise.
        """
        ...


class DatatableActionLink[M](DatatableAction[M]):
    """A datatable action that renders as a navigation link.

    Creates a standard HTML anchor link that navigates to another page.
    The href can be static or dynamically generated based on the request
    and item data.

    Args:
        M: Type parameter for the model type.
    """

    def __init__(
        self,
        label: str,
        href: str | URL | Callable[[Request, M], str],
        target: str | None = None,
    ) -> None:
        """Initialize the action link.

        Args:
            label: The text to display for the link.
            href: The URL to link to. Can be a static string/URL or a callable
                that generates the URL from request and item.
            target: Optional target attribute for the link (e.g., "_blank").
        """
        self.label = label
        self.href = href
        self.target = target

    @contextlib.contextmanager
    def render(self, request: Request, item: M) -> Generator[None]:
        """Render the action as a link.

        Args:
            request: The FastAPI request object.
            item: The model item this action applies to.
        """
        href: str
        if callable(self.href):
            href = self.href(request, item)
        else:
            href = str(self.href)
        with tag.a(href=href, target=self.target if self.target else None):
            text(self.label)
        yield

    def is_hidden(self, request: Request, item: M) -> bool:
        """Check if the action should be hidden.

        Returns:
            Always False - link actions are never hidden by default.
        """
        return False


class DatatableActionHTMX[M](DatatableAction[M]):
    """A datatable action that performs an HTMX request.

    Creates a button that triggers an HTMX GET request and updates a target
    element with the response. Useful for loading modals, updating page
    sections, or other dynamic interactions.

    Args:
        M: Type parameter for the model type.
    """

    def __init__(
        self,
        label: str,
        href: str | URL | Callable[[Request, M], str],
        target: str,
        hidden: Callable[[Request, M], bool] | None = None,
    ) -> None:
        """
        Args:
            label: The text to display on the button.
            href: The URL to request. Can be static or a callable that generates
                the URL based on request and item data.
            target: The HTMX selector for the element to update with the response.
            hidden: Optional function to determine if action should be hidden
                for specific items.
        """
        self.label = label
        self.href = href
        self.target = target
        self.hidden = hidden

    @contextlib.contextmanager
    def render(self, request: Request, item: M) -> Generator[None]:
        """Render the action as an HTMX button.

        Args:
            request: The FastAPI request object.
            item: The model item this action applies to.
        """
        href: str
        if callable(self.href):
            href = self.href(request, item)
        else:
            href = str(self.href)
        with tag.button(type="button", hx_get=str(href), hx_target=self.target):
            text(self.label)
        yield

    def is_hidden(self, request: Request, item: M) -> bool:
        """Check if the action should be hidden for a specific item.

        Args:
            request: The FastAPI request object.
            item: The model item to check visibility for.

        Returns:
            True if the action should be hidden, False otherwise.
        """
        if self.hidden is None:
            return False
        return self.hidden(request, item)


class DatatableActionsColumn[M](DatatableColumn[M]):
    """A datatable column that displays a dropdown menu of actions for each row.

    Creates a column with an ellipsis button that opens a popover menu containing
    action items. Actions that are hidden for specific items are automatically
    filtered out. If no actions are visible, no button is rendered.

    Args:
        M: Type parameter for the model type.
    """

    def __init__(self, label: str, *actions: DatatableAction[M]) -> None:
        """
        Args:
            label: The column header text.
            *actions: Variable number of DatatableAction instances to include
                in the dropdown menu.
        """
        self.actions = actions
        super().__init__(label)

    def render(self, request: Request, item: M) -> Generator[None] | None:
        """Render the actions dropdown for a specific item.

        Args:
            request: The FastAPI request object.
            item: The model item to render actions for.
        """
        displayed_actions = [
            action for action in self.actions if not action.is_hidden(request, item)
        ]
        if not displayed_actions:
            return None

        popover_id = "".join(random.choice(string.ascii_letters) for _ in range(8))
        with tag.button(
            type="button",
            classes="btn btn-ghost m-1",
            popovertarget=f"popover-{popover_id}",
            style=f"anchor-name:--anchor-{popover_id}",
        ):
            with tag.div(classes="font-normal icon-ellipsis-vertical"):
                pass

        with tag.ul(
            classes="dropdown menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm",
            popover=True,
            id=f"popover-{popover_id}",
            style=f"position-anchor:--anchor-{popover_id}",
        ):
            for action in displayed_actions:
                with tag.li():
                    with action.render(request, item):
                        pass

        return None


class SortWay(Enum):
    ASC = auto()
    DESC = auto()


class Datatable[M, PE: StrEnum]:
    """A complete datatable component with sorting and customizable columns.

    Renders a responsive table with configurable columns, automatic sorting controls,
    and empty state handling. Columns can display attributes, custom content, or
    action menus.

    Args:
        M: Type parameter for the model type being displayed.
        PE: Type parameter for the sorting field enum.
    """

    def __init__(
        self, *columns: DatatableColumn[M], empty_message: str | None = None
    ) -> None:
        """
        Args:
            *columns: Variable number of DatatableColumn instances that define
                the table structure and content.
            empty_message: Custom message to display when no items are present.
                Defaults to "No items found".
        """
        self.columns = columns
        self.empty_message = empty_message or "No items found"

    @contextlib.contextmanager
    def render(
        self,
        request: Request,
        items: Sequence[M],
        *,
        sorting: list[Sorting[PE]] | None = None,
    ) -> Generator[None]:
        """Render the complete datatable with headers, data, and sorting controls.

        Args:
            request: The FastAPI request object for URL generation.
            items: The sequence of model items to display in the table.
            sorting: Current sorting configuration for sortable columns.
            If None, no sorting controls are rendered.
        """
        with tag.div(
            classes="overflow-x-auto rounded-box bg-base-100 border-1 border-base-200"
        ):
            with tag.table(classes="table table-auto"):
                with tag.thead():
                    with tag.tr():
                        for column in self.columns:
                            with tag.th():
                                if (
                                    sorting is None
                                    or not isinstance(column, DatatableSortingColumn)
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
                    if not items:
                        with tag.tr():
                            with tag.td(
                                classes="text-2xl h-96 text-gray-500 text-center my-10",
                                colspan=len(self.columns),
                            ):
                                text(self.empty_message)
                    else:
                        for item in items:
                            with tag.tr():
                                for column in self.columns:
                                    with tag.td():
                                        with column._do_render(request, item):
                                            pass

        yield

    def _get_column_sort(
        self, sorting: list[Sorting[PE]] | None, column: DatatableSortingColumn[M, PE]
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
        column: DatatableSortingColumn[M, PE],
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

    def __repr__(self) -> str:
        return f"{self.__class__.__name__}(columns={self.columns!r}, empty_message={self.empty_message!r})"


@contextlib.contextmanager
def pagination(
    request: Request, pagination: PaginationParams, count: int
) -> Generator[None]:
    """Render pagination controls for a datatable.

    Creates a pagination component with item count display and previous/next
    navigation buttons. The buttons are automatically disabled when at the
    first or last page. URLs preserve existing query parameters while updating
    the page parameter.

    Args:
        request: The FastAPI request object for URL generation.
        pagination: Pagination parameters containing current page and limit.
        count: Total number of items across all pages.

    Example:
        >>> with pagination(request, PaginationParams(page=2, limit=10), 50):
        ...     pass
    """
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
    "Datatable",
    "DatatableActionsColumn",
    "DatatableAttrColumn",
    "DatatableColumn",
    "DatatableDateTimeColumn",
    "pagination",
]
