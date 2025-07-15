from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class CheckoutSortProperty(StrEnum):
    created_at = "created_at"
    expires_at = "expires_at"
    status = "status"


ListSorting = Annotated[
    list[Sorting[CheckoutSortProperty]],
    Depends(SortingGetter(CheckoutSortProperty, ["-created_at"])),
]
