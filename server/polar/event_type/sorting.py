from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class EventTypesSortProperty(StrEnum):
    event_type_name = "name"
    event_type_label = "label"
    occurrences = "occurrences"
    first_seen = "first_seen"
    last_seen = "last_seen"


EventTypesSorting = Annotated[
    list[Sorting[EventTypesSortProperty]],
    Depends(
        SortingGetter(
            EventTypesSortProperty,
            ["-last_seen"],
        )
    ),
]
