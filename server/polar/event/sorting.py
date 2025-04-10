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
    events_count = "events_count"
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
