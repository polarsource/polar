from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class SupportCaseSortProperty(StrEnum):
    created_at = "created_at"


ListSorting = Annotated[
    list[Sorting[SupportCaseSortProperty]],
    Depends(SortingGetter(SupportCaseSortProperty, ["-created_at"])),
]
