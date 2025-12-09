from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class DisputeSortProperty(StrEnum):
    created_at = "created_at"
    amount = "amount"


ListSorting = Annotated[
    list[Sorting[DisputeSortProperty]],
    Depends(SortingGetter(DisputeSortProperty, ["-created_at"])),
]
