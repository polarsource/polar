from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class DiscountSortProperty(StrEnum):
    created_at = "created_at"
    discount_name = "name"  # `name` is a reserved word, so we use `discount_name`


ListSorting = Annotated[
    list[Sorting[DiscountSortProperty]],
    Depends(SortingGetter(DiscountSortProperty, ["-created_at"])),
]
