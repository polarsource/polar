from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class RefundSortProperty(StrEnum):
    created_at = "created_at"
    amount = "amount"


RefundListSorting = Annotated[
    list[Sorting[RefundSortProperty]],
    Depends(SortingGetter(RefundSortProperty, ["-created_at"])),
]
