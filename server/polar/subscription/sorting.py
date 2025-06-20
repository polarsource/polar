from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class SubscriptionSortProperty(StrEnum):
    customer = "customer"
    status = "status"
    started_at = "started_at"
    current_period_end = "current_period_end"
    amount = "amount"
    product = "product"
    discount = "discount"


ListSorting = Annotated[
    list[Sorting[SubscriptionSortProperty]],
    Depends(SortingGetter(SubscriptionSortProperty, ["-started_at"])),
]
