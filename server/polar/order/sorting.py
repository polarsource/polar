from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class OrderSortProperty(StrEnum):
    created_at = "created_at"
    amount = "amount"
    user = "user"
    product = "product"
    subscription = "subscription"


ListSorting = Annotated[
    list[Sorting[OrderSortProperty]],
    Depends(SortingGetter(OrderSortProperty, ["-created_at"])),
]
