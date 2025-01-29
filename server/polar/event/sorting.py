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
