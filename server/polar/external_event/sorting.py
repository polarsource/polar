from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class ExternalEventSortProperty(StrEnum):
    created_at = "created_at"
    handled_at = "handled_at"
    source = "source"
    task_name = "task_name"


ListSorting = Annotated[
    list[Sorting[ExternalEventSortProperty]],
    Depends(SortingGetter(ExternalEventSortProperty, ["-created_at"])),
]
