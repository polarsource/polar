from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class CheckoutLinkSortProperty(StrEnum):
    created_at = "created_at"


ListSorting = Annotated[
    list[Sorting[CheckoutLinkSortProperty]],
    Depends(SortingGetter(CheckoutLinkSortProperty, ["-created_at"])),
]
