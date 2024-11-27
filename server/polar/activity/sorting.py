from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class ActivitySortProperty(StrEnum):
    created_at = "created_at"


ListSorting = Annotated[
    list[Sorting[ActivitySortProperty]],
    Depends(SortingGetter(ActivitySortProperty, ["-created_at"])),
]
