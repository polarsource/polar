from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class EventSortProperty(StrEnum):
    timestamp = "timestamp"


ListSorting = Annotated[
    list[Sorting[EventSortProperty]],
    Depends(SortingGetter(EventSortProperty, ["-timestamp"])),
]


class EventNamesSortProperty(StrEnum):
    event_name = "name"  # `name` is a reserved word, so we use `event_name`
    occurrences = "occurrences"
    first_seen = "first_seen"
    last_seen = "last_seen"


EventNamesSorting = Annotated[
    list[Sorting[EventNamesSortProperty]],
    Depends(
        SortingGetter(
            EventNamesSortProperty,
            ["-last_seen"],
        )
    ),
]


class EventStatisticsSortProperty(StrEnum):
    event_name = "name"  # `name` is a reserved word, so we use `event_name`
    occurrences = "occurrences"
    total = "total"
    average = "average"
    p95 = "p95"
    p99 = "p99"


EventStatisticsSorting = Annotated[
    list[Sorting[EventStatisticsSortProperty]],
    Depends(
        SortingGetter(
            EventStatisticsSortProperty,
            ["-total"],
        )
    ),
]


class EventPropertyStatisticsSortProperty(StrEnum):
    value = "value"
    occurrences = "occurrences"
    customers = "customers"
    total = "total"
    average = "average"


EventPropertyStatisticsSorting = Annotated[
    list[Sorting[EventPropertyStatisticsSortProperty]],
    Depends(SortingGetter(EventPropertyStatisticsSortProperty, ["-total"])),
]


class EventCustomerStatisticsSortProperty(StrEnum):
    occurrences = "occurrences"
    total = "total"
    average = "average"


EventCustomerStatisticsSorting = Annotated[
    list[Sorting[EventCustomerStatisticsSortProperty]],
    Depends(SortingGetter(EventCustomerStatisticsSortProperty, ["-total"])),
]
