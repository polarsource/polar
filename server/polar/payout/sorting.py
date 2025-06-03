from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class PayoutSortProperty(StrEnum):
    created_at = "created_at"
    amount = "amount"
    status = "status"
    account_id = "account_id"


ListSorting = Annotated[
    list[Sorting[PayoutSortProperty]],
    Depends(SortingGetter(PayoutSortProperty, ["-created_at"])),
]
